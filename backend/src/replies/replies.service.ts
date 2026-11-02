// src/replies/replies.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityActor,
  ActivityType,
  Candidate,
  CandidateStatus,
  CardType,
  EmailStatus,
  Job,
  MessageRole,
  PendingActionStatus,
  PendingActionType,
  ReplyClassification,
  ReplyDraftStatus,
} from '@prisma/client';
import { Job as QueueJob, Queue, Worker } from 'bullmq';
import { CandidatesService } from 'src/chat/candidates.service';
import { ChatService } from 'src/chat/chat.service';
import { EventsService } from 'src/chat/events.service';
import { meetingDraft } from 'src/meetings/meeting-draft';
import { MeetingsService, OPEN_STATUSES } from 'src/meetings/meetings.service';
import { MailerService } from 'src/outreach/mailer.service';
import { OutreachService } from 'src/outreach/outreach.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { queueOptions } from 'src/queue/redis-options';
import { isSafeToAutoSend } from './auto-reply';
import { InboxService } from './inbox.service';
import { ReplyReaderService } from './reply-reader.service';
import type { ReplyReading } from './reply-reader.service';

const QUEUE_NAME = 'replies';
const DAY_MS = 24 * 60 * 60 * 1000;
const INBOX_CHECK_MS = 60_000;
const MAX_AUTO_REPLIES_PER_DAY = 20;

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true,
  removeOnFail: true,
};

const STATUS_BY_CLASSIFICATION: Record<ReplyClassification, CandidateStatus> = {
  INTERESTED: CandidateStatus.INTERESTED,
  WANTS_MEETING: CandidateStatus.INTERESTED,
  QUESTION: CandidateStatus.REPLIED,
  NOT_INTERESTED: CandidateStatus.NOT_INTERESTED,
  UNSUBSCRIBE: CandidateStatus.UNSUBSCRIBED,
};

// A later reply must not undo progress. Only unsubscribing overrides these.
const LATER_STAGES: CandidateStatus[] = [
  CandidateStatus.MEETING_BOOKED,
  CandidateStatus.INTERVIEWED,
  CandidateStatus.SHORTLISTED,
  CandidateStatus.HIRED,
];

const AUTO_SENT_MESSAGE =
  'Auto-reply is on for this job and this was a simple case, so I answered them.';

const CARD_MESSAGES: Record<ReplyClassification, string> = {
  INTERESTED: 'They sound interested. I drafted a reply for you to check.',
  WANTS_MEETING: 'They want a meeting. I drafted a reply for you to check.',
  QUESTION: 'They have a question. I drafted a reply for you to check.',
  NOT_INTERESTED: "They're not interested. I drafted a polite reply for you to check.",
  UNSUBSCRIBE:
    "They asked not to be contacted. I've stopped all outreach to them, and nothing will be sent.",
};

type ReplyPayload = { replyId?: string };

function replySubject(subject: string | undefined, jobTitle: string) {
  const original = subject ?? jobTitle;
  return /^re:/i.test(original) ? original : `Re: ${original}`;
}

@Injectable()
export class RepliesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RepliesService.name);
  private queue: Queue<ReplyPayload>;
  private worker: Worker<ReplyPayload>;
  private lastWorkerError: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly events: EventsService,
    private readonly mailer: MailerService,
    private readonly outreach: OutreachService,
    private readonly reader: ReplyReaderService,
    private readonly inbox: InboxService,
    private readonly candidates: CandidatesService,
    private readonly meetings: MeetingsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const options = queueOptions(this.configService);

    this.queue = new Queue(QUEUE_NAME, options);
    this.worker = new Worker<ReplyPayload>(
      QUEUE_NAME,
      (job) => this.process(job),
      options,
    );

    this.worker.on('failed', (job, error) => {
      void this.handleJobFailure(job, error);
    });
    this.worker.on('error', (error) => {
      if (error.message === this.lastWorkerError) return;
      this.lastWorkerError = error.message;
      this.logger.error(error.message);
    });

    if (this.inbox.enabled) {
      await this.queue.upsertJobScheduler(
        'inbox',
        { every: INBOX_CHECK_MS },
        { name: 'inbox', opts: { removeOnComplete: true, removeOnFail: true } },
      );
    } else {
      await this.queue.removeJobScheduler('inbox');
    }
  }

  private process(job: QueueJob<ReplyPayload>) {
    switch (job.name) {
      case 'inbox':
        return this.checkInbox();
      case 'send':
        return this.sendDraft(job.data.replyId ?? '');
      default:
        return this.readReply(job.data.replyId ?? '');
    }
  }

  // One bad email shouldn't hold up the others, and a retry finds it again
  private async checkInbox() {
    for (const { candidateId, userId, body, messageId } of await this.inbox.newReplies()) {
      try {
        await this.receive(candidateId, userId, body, messageId);
      } catch (error) {
        this.logger.warn(`Skipped an inbox reply: ${(error as Error).message}`);
      }
    }
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }

  // Everything that must not wait for the AI happens here, before any model call
  async receive(
    candidateId: string,
    userId: string,
    body: string,
    inboundMessageId?: string,
  ) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, job: { userId } },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }
    if (candidate.status === CandidateStatus.UNSUBSCRIBED) {
      throw new ConflictException('This candidate has unsubscribed');
    }

    const lastEmail = await this.prisma.outboundEmail.findFirst({
      where: { candidateId, status: EmailStatus.SENT },
      orderBy: { sentAt: 'desc' },
      include: { campaignStep: { include: { campaign: true } } },
    });

    if (!lastEmail) {
      throw new BadRequestException('This candidate has not been emailed yet');
    }

    const { conversationId } = lastEmail.campaignStep.campaign;
    const reply = await this.prisma.candidateReply.create({
      data: {
        candidateId,
        conversationId,
        outboundEmailId: lastEmail.id,
        body,
        inboundMessageId,
      },
    });

    await this.outreach.stopFollowUps(candidateId);
    await this.prisma.activityLog.create({
      data: {
        jobId: candidate.jobId,
        candidateId,
        actor: ActivityActor.SYSTEM,
        type: ActivityType.REPLY_RECEIVED,
        summary: `${candidate.name ?? 'A candidate'} replied`,
      },
    });

    if (candidate.status === CandidateStatus.CONTACTED) {
      await this.candidates.changeStatus(candidate, CandidateStatus.REPLIED, ActivityActor.SYSTEM);
    }

    await this.chat.appendMessage(conversationId, {
      role: MessageRole.ASSISTANT,
      content: `${candidate.name ?? 'A candidate'} replied. Their follow-ups are stopped while I read it.`,
      cardType: CardType.CANDIDATE_REPLY,
      replyId: reply.id,
    });

    await this.queue.add('read', { replyId: reply.id }, JOB_OPTIONS);
    return reply;
  }

  // The content rules, then limits that need the database. Any "no" means a person decides.
  private async canAutoSend(
    job: Job,
    candidate: Candidate,
    replyBody: string,
    reading: ReplyReading,
  ) {
    if (
      !job.autoReply ||
      LATER_STAGES.includes(candidate.status) ||
      !isSafeToAutoSend(replyBody, reading)
    ) {
      return false;
    }

    // One per person, so two mail robots can never keep answering each other
    const [forCandidate, today] = await Promise.all([
      this.prisma.candidateReply.count({
        where: { candidateId: candidate.id, autoSent: true },
      }),
      this.prisma.candidateReply.count({
        where: {
          autoSent: true,
          candidate: { jobId: job.id },
          receivedAt: { gte: new Date(Date.now() - DAY_MS) },
        },
      }),
    ]);

    return forCandidate === 0 && today < MAX_AUTO_REPLIES_PER_DAY;
  }

  private async readReply(replyId: string) {
    const reply = await this.prisma.candidateReply.findUniqueOrThrow({
      where: { id: replyId },
      include: {
        candidate: { include: { job: { include: { user: true } } } },
        outboundEmail: {
          include: { campaignStep: { include: { campaign: true } } },
        },
      },
    });

    // A retry after this point must not classify or draft a second time
    if (reply.classification) return;

    const { candidate, outboundEmail } = reply;
    const { job } = candidate;

    const reading = await this.reader.read({
      job,
      candidateName: candidate.name,
      senderName:
        outboundEmail?.campaignStep.campaign.senderName ??
        job.user.name ??
        job.user.email,
      lastEmail: outboundEmail,
      reply: reply.body,
      hasBookedMeeting: await this.meetings.hasBookedMeeting(candidate.id),
    });

    const nextStatus = STATUS_BY_CLASSIFICATION[reading.classification];
    const isUnsubscribe = reading.classification === ReplyClassification.UNSUBSCRIBE;

    if (isUnsubscribe || !LATER_STAGES.includes(candidate.status)) {
      await this.candidates.changeStatus(candidate, nextStatus, ActivityActor.AI);
    }

    if (isUnsubscribe) {
      await this.meetings.cancelOpen(candidate.id);
    }
    if (reading.classification === ReplyClassification.WANTS_MEETING) {
      await this.meetings.prepare(candidate.id, reply.conversationId, replyId);
    }

    const autoSend = await this.canAutoSend(job, candidate, reply.body, reading);

    const action =
      reading.draft && !autoSend
        ? await this.prisma.pendingAction.create({
            data: {
              conversationId: reply.conversationId,
              type: PendingActionType.SEND_REPLY,
              jobId: candidate.jobId,
              replyId,
            },
          })
        : null;

    const draftStatus = autoSend
      ? ReplyDraftStatus.APPROVED
      : ReplyDraftStatus.PENDING_APPROVAL;

    await this.prisma.$transaction([
      this.prisma.candidateReply.update({
        where: { id: replyId },
        data: {
          classification: reading.classification,
          draftBody: reading.draft,
          draftStatus: reading.draft ? draftStatus : null,
          autoSent: autoSend,
        },
      }),
      this.prisma.message.updateMany({
        where: { replyId, cardType: CardType.CANDIDATE_REPLY },
        data: {
          content: `${candidate.name ?? 'A candidate'} replied. ${autoSend ? AUTO_SENT_MESSAGE : CARD_MESSAGES[reading.classification]}`,
          pendingActionId: action?.id,
        },
      }),
    ]);

    if (autoSend) {
      await this.queue.add('send', { replyId }, JOB_OPTIONS);
    }

    this.events.publish(reply.conversationId, { type: 'changed' });
  }

  private async findOwned(replyId: string, userId: string) {
    const reply = await this.prisma.candidateReply.findFirst({
      where: { id: replyId, candidate: { job: { userId } } },
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }
    return reply;
  }

  // Setting a time replaces the booking link with an invite, so the draft has to say so
  async setMeetingTime(
    replyId: string,
    userId: string,
    startsAt: Date | null,
    timeZone: string,
  ) {
    await this.findOwned(replyId, userId);

    if (startsAt && startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('Pick a time in the future');
    }

    const reply = await this.prisma.candidateReply.findUniqueOrThrow({
      where: { id: replyId },
      include: {
        meeting: true,
        candidate: { include: { job: { include: { user: true } } } },
        outboundEmail: {
          include: { campaignStep: { include: { campaign: true } } },
        },
      },
    });
    const { meeting, candidate, outboundEmail } = reply;

    if (
      !meeting ||
      !OPEN_STATUSES.includes(meeting.status) ||
      reply.draftStatus !== ReplyDraftStatus.PENDING_APPROVAL
    ) {
      throw new ConflictException('This meeting can no longer be changed');
    }

    const draftBody = meetingDraft({
      candidateName: candidate.name,
      senderName:
        outboundEmail?.campaignStep.campaign.senderName ??
        candidate.job.user.name ??
        candidate.job.user.email,
      startsAt,
      timeZone,
    });

    await this.prisma.$transaction([
      this.prisma.meeting.update({
        where: { id: meeting.id },
        data: { startsAt },
      }),
      this.prisma.candidateReply.update({
        where: { id: replyId },
        data: { draftBody },
      }),
      // A chat card showing the old text must not overwrite the new one
      this.prisma.pendingAction.updateMany({
        where: {
          replyId,
          type: PendingActionType.APPROVE_REPLY,
          status: PendingActionStatus.PENDING,
        },
        data: {
          status: PendingActionStatus.CANCELLED,
          resolvedAt: new Date(),
        },
      }),
    ]);

    return { draftBody };
  }

  async updateDraft(replyId: string, userId: string, draftBody: string) {
    await this.findOwned(replyId, userId);

    const { count } = await this.prisma.candidateReply.updateMany({
      where: { id: replyId, draftStatus: ReplyDraftStatus.PENDING_APPROVAL },
      data: { draftBody },
    });

    if (count === 0) {
      throw new ConflictException('This reply can no longer be edited');
    }
    return { success: true };
  }

  // Called from the confirm path only, so a recruiter approves every email sent here
  async approve(replyId: string) {
    const { count } = await this.prisma.candidateReply.updateMany({
      where: { id: replyId, draftStatus: ReplyDraftStatus.PENDING_APPROVAL },
      data: { draftStatus: ReplyDraftStatus.APPROVED },
    });

    if (count === 0) {
      throw new ConflictException('This reply is not waiting for approval');
    }

    await this.queue.add('send', { replyId }, JOB_OPTIONS);
  }

  async discard(replyId: string) {
    await this.prisma.candidateReply.updateMany({
      where: { id: replyId, draftStatus: ReplyDraftStatus.PENDING_APPROVAL },
      data: { draftStatus: ReplyDraftStatus.DISCARDED },
    });
    await this.meetings.discardDraft(replyId);
  }

  private async sendDraft(replyId: string) {
    // The atomic claim is what stops a retry sending the same reply twice
    const { count } = await this.prisma.candidateReply.updateMany({
      where: { id: replyId, draftStatus: ReplyDraftStatus.APPROVED },
      data: { draftStatus: ReplyDraftStatus.SENDING },
    });
    if (count === 0) return;

    const reply = await this.prisma.candidateReply.findUniqueOrThrow({
      where: { id: replyId },
      include: {
        candidate: { include: { job: { include: { user: true } } } },
        meeting: true,
        outboundEmail: {
          include: { campaignStep: { include: { campaign: true } } },
        },
      },
    });
    const { candidate, outboundEmail, meeting } = reply;
    const meetingTime = meeting?.startsAt ?? null;

    // They may have unsubscribed in a newer reply since this draft was approved
    if (
      !candidate.email ||
      candidate.status === CandidateStatus.UNSUBSCRIBED
    ) {
      await this.prisma.candidateReply.update({
        where: { id: replyId },
        data: { draftStatus: ReplyDraftStatus.DISCARDED },
      });
      this.events.publish(reply.conversationId, { type: 'changed' });
      return;
    }

    let result: Awaited<ReturnType<MailerService['send']>>;
    try {
      result = await this.mailer.send({
        to: candidate.email,
        senderName:
          outboundEmail?.campaignStep.campaign.senderName ??
          candidate.job.user.name ??
          candidate.job.user.email,
        subject: replySubject(outboundEmail?.subject, candidate.job.title),
        body:
          meeting && !meetingTime
            ? this.meetings.withBookingLink(reply.draftBody ?? '', meeting.token)
            : (reply.draftBody ?? ''),
        inReplyTo: outboundEmail?.messageId ?? undefined,
        recipientName: candidate.name,
        invite:
          meeting && meetingTime
            ? {
                uid: meeting.id,
                summary: `${candidate.job.title} interview`,
                startsAt: meetingTime,
              }
            : undefined,
      });
    } catch (error) {
      // Nothing was delivered, so handing it back for the retry is safe
      await this.prisma.candidateReply.update({
        where: { id: replyId },
        data: { draftStatus: ReplyDraftStatus.APPROVED },
      });
      throw error;
    }

    await this.prisma.$transaction([
      this.prisma.candidateReply.update({
        where: { id: replyId },
        data: {
          draftStatus: ReplyDraftStatus.SENT,
          sentAt: new Date(),
          ...result,
        },
      }),
      this.prisma.activityLog.create({
        data: {
          jobId: candidate.jobId,
          candidateId: candidate.id,
          actor: reply.autoSent ? ActivityActor.AI : ActivityActor.RECRUITER,
          type: ActivityType.REPLY_SENT,
          summary: `${reply.autoSent ? 'Auto-replied' : 'Replied'} to ${candidate.name ?? 'a candidate'}`,
        },
      }),
    ]);

    // The link and the time only count now that the recruiter's email has gone out
    if (meeting && meetingTime) {
      await this.meetings.confirmTime(meeting.id);
    } else if (meeting) {
      await this.meetings.markLinkSent(meeting.id);
    }

    this.events.publish(reply.conversationId, { type: 'changed' });
  }

  private async handleJobFailure(
    job: QueueJob<ReplyPayload> | undefined,
    error: Error,
  ) {
    this.logger.error(`Reply job failed: ${error.message}`);

    // Earlier attempts will retry, so only the last failure is recorded
    if (!job?.data.replyId || job.attemptsMade < (job.opts.attempts ?? 1)) return;

    const isSend = job.name === 'send';
    const reply = await this.prisma.candidateReply.update({
      where: { id: job.data.replyId },
      data: {
        error: error.message,
        ...(isSend ? { draftStatus: ReplyDraftStatus.FAILED } : {}),
      },
    });

    if (isSend) {
      await this.prisma.pendingAction.updateMany({
        where: { replyId: reply.id, status: PendingActionStatus.EXECUTED },
        data: { status: PendingActionStatus.FAILED },
      });
    }

    await this.chat.appendMessage(reply.conversationId, {
      role: MessageRole.ASSISTANT,
      content: isSend
        ? "I couldn't send that reply after several tries, so it did not go out."
        : "I couldn't read that reply after several tries. Follow-ups stay stopped, so please read it yourself on the card above.",
    });
  }
}
