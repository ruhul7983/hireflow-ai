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
  CampaignChange,
  CandidateStatus,
  CardType,
  MessageRole,
  PendingAction,
  PendingActionStatus,
  PendingActionType,
  RemotePolicy,
} from '@prisma/client';
import { JobsService } from 'src/jobs/jobs.service';
import { OutreachService } from 'src/outreach/outreach.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RepliesService } from 'src/replies/replies.service';
import { SourcingService } from 'src/sourcing/sourcing.service';
import { statusLabel } from './candidate-status';
import { CandidatesService } from './candidates.service';
import { ChatService } from './chat.service';
import { PipelineService } from './pipeline.service';

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

export type CampaignProposal = {
  name: string;
  dayOffsets: number[];
  dailyLimit: number;
  instructions: string | null;
  candidateIds: string[];
};

const CHANGE_NOTES: Record<CampaignChange, string> = {
  SEND: 'approve the drafts and start sending',
  PAUSE: 'pause it. Nothing more goes out until you resume it',
  RESUME: 'resume it',
  STOP: 'stop it for good. Emails not sent yet are cancelled',
};

function candidateCount(count: number) {
  return `${count} ${count === 1 ? 'candidate' : 'candidates'}`;
}

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly sourcing: SourcingService,
    private readonly candidates: CandidatesService,
    private readonly outreach: OutreachService,
    private readonly replies: RepliesService,
    private readonly pipeline: PipelineService,
    private readonly jobs: JobsService,
  ) {}

  // Reply drafts are left out because several can wait at once, each to a different
  // person, so "yes" in chat could send the wrong one. They're approved on their card.
  latestPending(conversationId: string) {
    return this.prisma.pendingAction.findFirst({
      where: {
        conversationId,
        status: PendingActionStatus.PENDING,
        type: { not: PendingActionType.SEND_REPLY },
      },
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

  // A stopped turn never shows its cards, and an unseen card must not catch a later "yes"
  async discardProposals(actionIds: string[]) {
    await this.prisma.pendingAction.updateMany({
      where: {
        id: { in: actionIds },
        status: PendingActionStatus.PENDING,
      },
      data: {
        status: PendingActionStatus.CANCELLED,
        resolvedAt: new Date(),
      },
    });
  }

  // A new setup replaces any plan that hasn't been confirmed yet
  cancelOpenCampaignPlans(conversationId: string) {
    return this.supersede(conversationId, PendingActionType.CREATE_CAMPAIGN);
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
      content: `Please confirm you want to ${verb} ${candidateCount(candidateIds.length)}.`,
      cardType: CardType.CANDIDATE_DECISION,
      pendingActionId: action.id,
      jobId,
    };
  }

  async proposeStatusChange(
    conversationId: string,
    candidate: { id: string; jobId: string; name: string | null },
    status: CandidateStatus,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.CHANGE_STATUS);

    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.CHANGE_STATUS,
        jobId: candidate.jobId,
        decision: status,
        candidates: { create: { candidateId: candidate.id } },
      },
    });

    return {
      content: `Please confirm you want to mark ${candidate.name ?? 'this candidate'} as ${statusLabel(status).toLowerCase()}.`,
      cardType: CardType.CANDIDATE_DECISION,
      pendingActionId: action.id,
      jobId: candidate.jobId,
    };
  }

  async proposeCampaignChange(
    conversationId: string,
    campaign: { id: string; jobId: string; name: string },
    change: CampaignChange | null,
    dailyLimit: number | null,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.CHANGE_CAMPAIGN);

    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.CHANGE_CAMPAIGN,
        jobId: campaign.jobId,
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignChange: change,
        dailyLimit,
      },
    });

    const limitNote = dailyLimit ? ` The limit becomes ${dailyLimit} a day.` : '';
    return {
      content: change
        ? `Please confirm you want to ${CHANGE_NOTES[change]}.${limitNote}`
        : `Please confirm the new limit.${limitNote}`,
      cardType: CardType.CAMPAIGN_CHANGE,
      pendingActionId: action.id,
      jobId: campaign.jobId,
    };
  }

  async proposeReplySend(
    conversationId: string,
    reply: { id: string; jobId: string; candidateName: string | null },
    draft: string,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.APPROVE_REPLY);

    const name = reply.candidateName ?? 'this candidate';
    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.APPROVE_REPLY,
        jobId: reply.jobId,
        replyId: reply.id,
        title: `Reply to ${name}`,
        detail: draft,
        confirmLabel: 'Send reply',
      },
    });

    return {
      content: `Please check this reply to ${name} before it goes out.`,
      cardType: CardType.CONFIRMATION,
      pendingActionId: action.id,
      jobId: reply.jobId,
    };
  }

  async proposeScoring(
    conversationId: string,
    jobId: string,
    count: number,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.RETRY_SCORING);

    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.RETRY_SCORING,
        jobId,
        title: `Score ${candidateCount(count)}`,
        confirmLabel: 'Start scoring',
      },
    });

    return {
      content: `${candidateCount(count)} still need a score. Should I score them now?`,
      cardType: CardType.CONFIRMATION,
      pendingActionId: action.id,
      jobId,
    };
  }

  async proposeAutoReplyChange(
    conversationId: string,
    job: { id: string; title: string },
    enabled: boolean,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.CHANGE_AUTO_REPLY);

    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.CHANGE_AUTO_REPLY,
        jobId: job.id,
        enabled,
        title: `Turn auto-reply ${enabled ? 'on' : 'off'} for ${job.title}`,
        detail: enabled
          ? 'The AI will answer simple replies without asking you first. Questions, and anything with a link, a figure or a price, still wait for you. It replies once per candidate, and up to 20 times a day.'
          : 'Every reply will wait for your approval.',
        confirmLabel: enabled ? 'Turn on' : 'Turn off',
      },
    });

    return {
      content: `Please confirm you want auto-reply ${enabled ? 'on' : 'off'}.`,
      cardType: CardType.CONFIRMATION,
      pendingActionId: action.id,
      jobId: job.id,
    };
  }

  // A draft holds the new values, so the recruiter gets the same editable card as for a new job
  async proposeJobUpdate(
    conversationId: string,
    jobId: string,
    fields: JobDraftFields,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.UPDATE_JOB);

    const draft = await this.prisma.jobDraft.create({
      data: { ...fields, conversationId },
    });
    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.UPDATE_JOB,
        jobId,
        jobDraftId: draft.id,
      },
    });

    return {
      content: 'Here is the job with your changes. Edit anything, then save.',
      cardType: CardType.JOB_DRAFT,
      pendingActionId: action.id,
      jobDraftId: draft.id,
    };
  }

  async proposeCampaign(
    conversationId: string,
    jobId: string,
    proposal: CampaignProposal,
  ): Promise<ProposedCard> {
    await this.supersede(conversationId, PendingActionType.CREATE_CAMPAIGN);

    const { candidateIds, name, ...details } = proposal;
    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId,
        type: PendingActionType.CREATE_CAMPAIGN,
        jobId,
        campaignName: name,
        ...details,
        candidates: {
          create: candidateIds.map((candidateId) => ({ candidateId })),
        },
      },
    });

    return {
      content: `Here is your plan for ${candidateCount(candidateIds.length)}. Confirm and I'll write the personal drafts. Nothing is sent yet.`,
      cardType: CardType.CAMPAIGN_PROPOSAL,
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

    const needsTitle: PendingActionType[] = [
      PendingActionType.CREATE_JOB,
      PendingActionType.UPDATE_JOB,
    ];
    if (needsTitle.includes(action.type) && !action.jobDraft?.title?.trim()) {
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

    // Only for drafts. Declining a change must leave the campaign running.
    if (action.campaignId && action.type === PendingActionType.SEND_CAMPAIGN) {
      await this.outreach.discard(action.campaignId);
    }
    if (action.replyId && action.type === PendingActionType.SEND_REPLY) {
      await this.replies.discard(action.replyId);
    }

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
      case PendingActionType.CHANGE_STATUS:
        return this.changeStatus(action);
      case PendingActionType.CREATE_CAMPAIGN:
        return this.createCampaign(action, userId);
      case PendingActionType.SEND_CAMPAIGN:
        if (!action.campaignId) throw new Error('The campaign no longer exists');
        return this.outreach.approve(action.campaignId);
      case PendingActionType.CHANGE_CAMPAIGN:
        return this.changeCampaign(action, userId);
      case PendingActionType.APPROVE_REPLY:
        return this.approveReply(action, userId);
      case PendingActionType.RETRY_SCORING:
        return this.retryScoring(action);
      case PendingActionType.UPDATE_JOB:
        return this.updateJob(action);
      case PendingActionType.CHANGE_AUTO_REPLY:
        return this.changeAutoReply(action, userId);
      case PendingActionType.SEND_REPLY:
        if (!action.replyId) throw new Error('The reply no longer exists');
        return this.replies.approve(action.replyId);
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
      // The chat that shaped this job is part of what it cost
      await tx.llmUsage.updateMany({
        where: { conversationId: action.conversationId, jobId: null },
        data: { jobId: created.id },
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

  private async createCampaign(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
    userId: string,
  ) {
    if (!action.jobId || !action.campaignName || !action.dailyLimit) {
      throw new Error('The campaign details are incomplete');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    await this.outreach.createCampaign({
      conversationId: action.conversationId,
      jobId: action.jobId,
      name: action.campaignName,
      dayOffsets: action.dayOffsets,
      dailyLimit: action.dailyLimit,
      instructions: action.instructions,
      senderName: user.name ?? user.email,
      candidateIds: action.candidates.map(({ candidateId }) => candidateId),
    });
  }

  private async changeCampaign(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
    userId: string,
  ) {
    if (!action.campaignId) throw new Error('The campaign no longer exists');

    const summary = await this.outreach.applyChange(
      action.campaignId,
      userId,
      action.campaignChange,
      action.dailyLimit,
    );

    if (!summary) return;

    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `Done. ${summary}.`,
    });
  }

  private async approveReply(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
    userId: string,
  ) {
    if (!action.replyId || !action.detail) {
      throw new Error('The reply no longer exists');
    }

    await this.replies.updateDraft(action.replyId, userId, action.detail);
    await this.replies.approve(action.replyId);

    // Closes the buttons on the reply's own card
    await this.prisma.pendingAction.updateMany({
      where: {
        replyId: action.replyId,
        type: PendingActionType.SEND_REPLY,
        status: PendingActionStatus.PENDING,
      },
      data: { status: PendingActionStatus.EXECUTED, resolvedAt: new Date() },
    });

    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: 'Approved. The reply is on its way.',
    });
  }

  private async retryScoring(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
  ) {
    if (!action.jobId) throw new Error('The job no longer exists');

    await this.sourcing.retryScoring(action.jobId);
    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: 'Scoring has started. I will post the results here.',
    });
  }

  private async updateJob(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
  ) {
    const draft = action.jobDraft;
    if (!action.jobId || !draft?.title) {
      throw new Error('The job details are incomplete');
    }

    const job = await this.prisma.job.update({
      where: { id: action.jobId },
      data: {
        title: draft.title,
        seniority: draft.seniority,
        location: draft.location,
        salary: draft.salary,
        remotePolicy: draft.remotePolicy,
        mustHaveSkills: draft.mustHaveSkills,
        niceToHaveSkills: draft.niceToHaveSkills,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        jobId: job.id,
        actor: ActivityActor.RECRUITER,
        type: ActivityType.JOB_UPDATED,
        summary: `Updated ${job.title}`,
      },
    });

    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `Done. ${job.title} is updated. Candidates already scored keep their scores.`,
    });
  }

  private async changeAutoReply(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
    userId: string,
  ) {
    if (!action.jobId || action.enabled === null) {
      throw new Error('The setting is incomplete');
    }

    await this.jobs.setAutoReply(action.jobId, userId, action.enabled);
    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `Done. Auto-reply is ${action.enabled ? 'on' : 'off'} for this job.`,
    });
  }

  private async changeStatus(
    action: Awaited<ReturnType<ActionsService['findOwned']>>,
  ) {
    const [target] = action.candidates;
    if (!action.jobId || !action.decision || !target) {
      throw new Error('The status change is incomplete');
    }

    await this.pipeline.updateStatus(
      action.jobId,
      target.candidateId,
      action.decision,
      ActivityActor.RECRUITER,
    );

    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `Done. They're now marked as ${statusLabel(action.decision).toLowerCase()}, and the change is in the activity log.`,
    });
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
    const offer =
      action.decision === CandidateStatus.ACCEPTED
        ? ' Use Set up outreach on the candidate table when you are ready to contact them.'
        : '';

    await this.chat.appendMessage(action.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `${verb} ${candidateCount(updated)}. Every decision is saved under the job.${offer}`,
    });
  }
}
