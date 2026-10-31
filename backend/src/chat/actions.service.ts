// src/chat/actions.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityActor,
  ActivityType,
  CandidateStatus,
  CardType,
  MessageRole,
  PendingAction,
  PendingActionStatus,
  PendingActionType,
  RemotePolicy,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SourcingService } from 'src/sourcing/sourcing.service';
import { CandidatesService } from './candidates.service';
import { ChatService } from './chat.service';

export type JobDraftFields = {
  title: string | null;
  seniority: string | null;
  location: string | null;
  salary: string | null;
  remotePolicy: RemotePolicy | null;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  description: string;
  sourceUrl: string | null;
};

export type ProposedCard = {
  content: string;
  cardType: CardType;
  pendingActionId: string;
  jobDraftId?: string;
  jobId?: string;
};

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly sourcing: SourcingService,
    private readonly candidates: CandidatesService,
  ) {}

  latestPending(conversationId: string) {
    return this.prisma.pendingAction.findFirst({
      where: { conversationId, status: PendingActionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Replacing an open proposal keeps "yes" pointed at the newest card
  private async supersede(conversationId: string, type: PendingActionType) {
    await this.prisma.pendingAction.updateMany({
      where: { conversationId, type, status: PendingActionStatus.PENDING },
      data: {
        status: PendingActionStatus.CANCELLED,
        resolvedAt: new Date(),
      },
    });
  }

  async proposeJob(
    conversationId: string,
    fields: JobDraftFields,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.CREATE_JOB);

    const draft = await this.prisma.jobDraft.create({
      data: { ...fields, conversationId },
    });
    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.CREATE_JOB,
        jobDraftId: draft.id,
      },
    });

    return {
      content: 'Here is what I picked up. Edit anything, then confirm.',
      cardType: CardType.JOB_DRAFT,
      pendingActionId: action.id,
      jobDraftId: draft.id,
    };
  }

  async proposeSourcing(
    conversationId: string,
    jobId: string,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.START_SOURCING);

    const action = await this.prisma.pendingAction.create({
      data: { conversationId, type: PendingActionType.START_SOURCING, jobId },
    });

    return {
      content:
        'Should I search the web for matching public profiles? You can also upload a CSV of candidates.',
      cardType: CardType.SOURCING_PROMPT,
      pendingActionId: action.id,
      jobId,
    };
  }

  async proposeDecision(
    conversationId: string,
    jobId: string,
    decision: CandidateStatus,
    candidateIds: string[],
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.DECIDE_CANDIDATES);

    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.DECIDE_CANDIDATES,
        jobId,
        decision,
        candidates: {
          create: candidateIds.map((candidateId) => ({ candidateId })),
        },
      },
    });

    const verb = decision === CandidateStatus.ACCEPTED ? 'accept' : 'reject';
    return {
      content: `Please confirm you want to ${verb} these ${candidateIds.length} candidates.`,
      cardType: CardType.CANDIDATE_DECISION,
      pendingActionId: action.id,
      jobId,
    };
  }

  private async findOwned(actionId: string, userId: string) {
    const action = await this.prisma.pendingAction.findFirst({
      where: { id: actionId, conversation: { userId } },
      include: { candidates: true, jobDraft: true },
    });

    if (!action) {
      throw new NotFoundException('Action not found');
    }
    return action;
  }

  // Claiming the row first means a double click or a retry can't run it twice
  private async claim(actionId: string, status: PendingActionStatus) {
    const { count } = await this.prisma.pendingAction.updateMany({
      where: { id: actionId, status: PendingActionStatus.PENDING },
      data: { status, resolvedAt: new Date() },
    });

    if (count === 0) {
      throw new ConflictException('This action has already been handled');
    }
  }

  // The only path that carries out a proposal. The agent has no tool that reaches it.
  async confirm(actionId: string, userId: string) {
    const action = await this.findOwned(actionId, userId);

    if (action.type === PendingActionType.CREATE_JOB && !action.jobDraft?.title?.trim()) {
      throw new BadRequestException('Add a job title before confirming');
    }

    await this.claim(actionId, PendingActionStatus.EXECUTED);

    try {
      await this.execute(action, userId);
    } catch (error) {
      this.logger.error(`Action ${actionId} failed: ${(error as Error).message}`);
      await this.prisma.pendingAction.update({
        where: { id: actionId },
        data: { status: PendingActionStatus.FAILED },
      });
      await this.chat.appendMessage(action.conversationId, {
        role: MessageRole.ASSISTANT,
        content: "That didn't go through, so nothing was changed. Please try again.",
      });
    }
  }

  async cancel(actionId: string, userId: string) {
    const action = await this.findOwned(actionId, userId);
    await this.claim(actionId, PendingActionStatus.CANCELLED);

    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: 'Okay, I cancelled that. Nothing was changed.',
    });
  }

  private async execute(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
    userId: string,
  ) {
    switch (action.type) {
      case PendingActionType.CREATE_JOB:
        return this.createJob(action, userId);
      case PendingActionType.START_SOURCING:
        return this.startSourcing(action, userId);
      case PendingActionType.DECIDE_CANDIDATES:
        return this.decideCandidates(action);
    }
  }

  private async createJob(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
    userId: string,
  ) {
    const draft = action.jobDraft;
    if (!draft) throw new Error('The draft no longer exists');

    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          userId,
          title: draft.title ?? '',
          seniority: draft.seniority,
          location: draft.location,
          salary: draft.salary,
          remotePolicy: draft.remotePolicy,
          mustHaveSkills: draft.mustHaveSkills,
          niceToHaveSkills: draft.niceToHaveSkills,
          description: draft.description,
          sourceUrl: draft.sourceUrl,
        },
      });

      await tx.jobDraft.update({
        where: { id: draft.id },
        data: { jobId: created.id },
      });
      await tx.conversation.update({
        where: { id: action.conversationId },
        data: { jobId: created.id, title: created.title },
      });
      await tx.activityLog.create({
        data: {
          jobId: created.id,
          actor: ActivityActor.RECRUITER,
          type: ActivityType.JOB_CREATED,
          summary: `Created ${created.title}`,
        },
      });

      return created;
    });

    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `${job.title} is saved.`,
      cardType: CardType.JOB_CREATED,
      jobId: job.id,
    });

    const prompt = await this.proposeSourcing(action.conversationId, job.id);
    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      ...prompt,
    });
  }

  private async startSourcing(
    action: PendingAction,
    userId: string,
  ) {
    if (!action.jobId) throw new Error('The job no longer exists');

    const job = await this.candidates.assertJobOwned(action.jobId, userId);
    await this.sourcing.startSearch(job, action.conversationId);
  }

  private async decideCandidates(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
  ) {
    if (!action.jobId || !action.decision) {
      throw new Error('The decision is incomplete');
    }

    const updated = await this.candidates.decide(
      action.jobId,
      action.candidates.map(({ candidateId }) => candidateId),
      action.decision,
      ActivityActor.RECRUITER,
    );

    const verb = action.decision === CandidateStatus.ACCEPTED ? 'Accepted' : 'Rejected';
    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `${verb} ${updated} ${updated === 1 ? 'candidate' : 'candidates'}. Every decision is saved under the job.`,
    });
  }
}
