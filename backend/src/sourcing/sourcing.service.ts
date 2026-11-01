// src/sourcing/sourcing.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityActor,
  ActivityType,
  CandidateSource,
  CardType,
  Job as JobRow,
  MessageRole,
  RunStatus,
} from '@prisma/client';
import { Job as QueueJob, Queue, Worker } from 'bullmq';
import { ChatService } from 'src/chat/chat.service';
import { EventsService } from 'src/chat/events.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { queueOptions } from 'src/queue/redis-options';
import { ParsedCandidate, parseSearchResult } from './candidate-parser';
import {
  CsvFormatError,
  CsvMapping,
  parseCandidateCsv,
  previewCsv,
} from './csv-mapping';
import { ScoringService } from './scoring.service';
import { SerperService } from './serper.service';

const SEARCH_QUEUE = 'sourcing';
const SCORING_QUEUE = 'scoring';
const SEARCH_PAGES = 3;
const SCORING_BATCH_SIZE = 8;

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true,
  removeOnFail: 100,
};

type RunPayload = { runId: string };

@Injectable()
export class SourcingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SourcingService.name);
  private searchQueue: Queue<RunPayload>;
  private scoringQueue: Queue<RunPayload>;
  private workers: Worker<RunPayload>[] = [];
  private lastWorkerError: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly events: EventsService,
    private readonly serper: SerperService,
    private readonly scoring: ScoringService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const options = queueOptions(this.configService);

    this.searchQueue = new Queue(SEARCH_QUEUE, options);
    this.scoringQueue = new Queue(SCORING_QUEUE, options);

    this.workers = [
      new Worker<RunPayload>(SEARCH_QUEUE, (job) => this.runSearch(job), options),
      new Worker<RunPayload>(SCORING_QUEUE, (job) => this.runScoring(job), options),
    ];

    for (const worker of this.workers) {
      worker.on('failed', (job, error) => this.handleJobFailure(job, error));
      // Without a listener, a lost Redis connection would crash the process
      worker.on('error', (error) => this.logWorkerError(error));
    }
  }

  // A worker can fail in a tight loop, so only a new error is worth a log line
  private logWorkerError(error: Error) {
    if (error.message === this.lastWorkerError) return;
    this.lastWorkerError = error.message;
    this.logger.error(error.message);
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all([this.searchQueue.close(), this.scoringQueue.close()]);
  }

  async startSearch(job: JobRow, conversationId: string) {
    const run = await this.prisma.sourcingRun.create({
      data: {
        jobId: job.id,
        conversationId,
        source: CandidateSource.SERPER,
        searchQuery: this.serper.buildQuery(job),
      },
    });

    await this.logRunStarted(job.id, `Started web sourcing for ${job.title}`);
    await this.chat.appendMessage(conversationId, {
      role: MessageRole.ASSISTANT,
      content: 'Sourcing has started. You can keep chatting while it runs.',
      cardType: CardType.SOURCING_PROGRESS,
      sourcingRunId: run.id,
    });

    await this.searchQueue.add('search', { runId: run.id }, JOB_OPTIONS);
    return run;
  }

  // Shows the recruiter how the file reads, and saves nothing
  previewCsv(file: Express.Multer.File) {
    return this.readingCsv(() => previewCsv(file.buffer));
  }

  private readingCsv<T>(read: () => T) {
    try {
      return read();
    } catch (error) {
      if (error instanceof CsvFormatError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async importCsv(
    job: JobRow,
    conversationId: string,
    file: Express.Multer.File,
    mapping: CsvMapping,
  ) {
    const parsed = this.readingCsv(() =>
      parseCandidateCsv(file.buffer, mapping),
    );

    if (parsed.candidates.length === 0) {
      throw new BadRequestException(
        'No usable rows with these matches. Check that the email or profile URL column holds real addresses.',
      );
    }

    const run = await this.prisma.sourcingRun.create({
      data: {
        jobId: job.id,
        conversationId,
        source: CandidateSource.CSV,
        fileName: file.originalname,
        status: RunStatus.SOURCING,
        skippedCount: parsed.skipped,
      },
    });

    await this.logRunStarted(job.id, `Imported ${file.originalname}`);
    await this.chat.appendMessage(conversationId, {
      role: MessageRole.ASSISTANT,
      content: `Importing ${file.originalname}.`,
      cardType: CardType.SOURCING_PROGRESS,
      sourcingRunId: run.id,
    });

    await this.saveCandidates(run.id, job.id, CandidateSource.CSV, parsed.candidates);
    await this.updateRun(run.id, {
      duplicateCount: await this.countDuplicates(run.id, parsed.candidates.length),
    });

    await this.scoringQueue.add('score', { runId: run.id }, JOB_OPTIONS);
    return run;
  }

  // Scoring only picks up unscored rows, so this finishes a run that failed part way
  async retryScoring(jobId: string) {
    const runs = await this.prisma.sourcingRun.findMany({
      where: { jobId, candidates: { some: { score: null } } },
      select: { id: true },
    });

    for (const { id } of runs) {
      await this.updateRun(id, { status: RunStatus.SCORING, error: null });
      await this.scoringQueue.add('score', { runId: id }, JOB_OPTIONS);
    }
  }

  private async runSearch(queueJob: QueueJob<RunPayload>) {
    const { runId } = queueJob.data;
    const run = await this.prisma.sourcingRun.findUniqueOrThrow({
      where: { id: runId },
    });

    await this.updateRun(runId, { status: RunStatus.SOURCING });

    let seen = 0;
    for (let page = 1; page <= SEARCH_PAGES; page += 1) {
      const results = await this.serper.search(run.searchQuery ?? '', page);
      const candidates = results
        .map(parseSearchResult)
        .filter((candidate) => candidate !== null);

      if (candidates.length === 0) break;

      seen += candidates.length;
      await this.saveCandidates(runId, run.jobId, CandidateSource.SERPER, candidates);
      await this.updateRun(runId, {
        duplicateCount: await this.countDuplicates(runId, seen),
      });
    }

    await this.scoringQueue.add('score', { runId }, JOB_OPTIONS);
  }

  private async runScoring(queueJob: QueueJob<RunPayload>) {
    const { runId } = queueJob.data;
    const run = await this.prisma.sourcingRun.findUniqueOrThrow({
      where: { id: runId },
      include: { job: true },
    });

    await this.updateRun(runId, { status: RunStatus.SCORING });

    // Only unscored rows, so a retry carries on instead of paying for them twice
    const candidates = await this.prisma.candidate.findMany({
      where: { sourcingRunId: runId, score: null },
      orderBy: { createdAt: 'asc' },
    });

    for (let index = 0; index < candidates.length; index += SCORING_BATCH_SIZE) {
      const batch = candidates.slice(index, index + SCORING_BATCH_SIZE);
      const scores = await this.scoring.scoreBatch(run.job, batch);

      await Promise.all(
        scores.map(({ id, score, reason }) =>
          this.prisma.candidate.update({
            where: { id },
            data: { score, scoreReason: reason },
          }),
        ),
      );

      await this.updateRun(runId, {
        scoredCount: await this.prisma.candidate.count({
          where: { sourcingRunId: runId, score: { not: null } },
        }),
      });
    }

    await this.finishRun(runId);
  }

  private async finishRun(runId: string) {
    const run = await this.updateRun(runId, {
      status: RunStatus.COMPLETED,
      finishedAt: new Date(),
    });

    await this.prisma.activityLog.create({
      data: {
        jobId: run.jobId,
        actor: ActivityActor.SYSTEM,
        type: ActivityType.SOURCING_FINISHED,
        summary: `Found ${run.foundCount} candidates and scored ${run.scoredCount}`,
      },
    });

    if (run.foundCount === 0) {
      await this.chat.appendMessage(run.conversationId, {
        role: MessageRole.ASSISTANT,
        content:
          run.duplicateCount > 0
            ? 'Everyone I found is already on this job, so nobody new was added.'
            : "I couldn't find any matching public profiles. You can upload a CSV, or edit the job and try again.",
      });
      return;
    }

    await this.chat.appendMessage(run.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `Done. I found ${run.foundCount} new candidates and scored ${run.scoredCount}. Accept or reject them below, or tell me something like "accept the top 5".`,
      cardType: CardType.CANDIDATE_TABLE,
      jobId: run.jobId,
    });
  }

  private async handleJobFailure(
    queueJob: QueueJob<RunPayload> | undefined,
    error: Error,
  ) {
    this.logger.error(`Sourcing job failed: ${error.message}`);

    // Earlier attempts will retry, so only the last failure reaches the recruiter
    if (!queueJob || queueJob.attemptsMade < (queueJob.opts.attempts ?? 1)) {
      return;
    }

    const run = await this.updateRun(queueJob.data.runId, {
      status: RunStatus.FAILED,
      error: error.message,
      finishedAt: new Date(),
    });

    await this.chat.appendMessage(run.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `Sourcing stopped after several retries: ${error.message}. Anything found so far is saved under the job.`,
    });
  }

  private async saveCandidates(
    runId: string,
    jobId: string,
    source: CandidateSource,
    candidates: ParsedCandidate[],
  ) {
    // The unique indexes on the job do the deduping, including within this batch
    await this.prisma.candidate.createMany({
      data: candidates.map((candidate) => ({
        ...candidate,
        jobId,
        source,
        sourcingRunId: runId,
      })),
      skipDuplicates: true,
    });

    await this.updateRun(runId, {
      foundCount: await this.prisma.candidate.count({
        where: { sourcingRunId: runId },
      }),
    });
  }

  private async countDuplicates(runId: string, seen: number) {
    const saved = await this.prisma.candidate.count({
      where: { sourcingRunId: runId },
    });
    return Math.max(0, seen - saved);
  }

  private async updateRun(
    runId: string,
    data: Parameters<PrismaService['sourcingRun']['update']>[0]['data'],
  ) {
    const run = await this.prisma.sourcingRun.update({
      where: { id: runId },
      data,
    });
    this.events.publish(run.conversationId, { type: 'run', run });
    return run;
  }

  private logRunStarted(jobId: string, summary: string) {
    return this.prisma.activityLog.create({
      data: {
        jobId,
        actor: ActivityActor.RECRUITER,
        type: ActivityType.SOURCING_STARTED,
        summary,
      },
    });
  }
}
