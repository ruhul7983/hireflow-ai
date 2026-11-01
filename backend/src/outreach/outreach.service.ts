// src/outreach/outreach.service.ts
import {
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
  CampaignChange,
  CampaignStatus,
  CandidateStatus,
  CardType,
  EmailStatus,
  MessageRole,
  PendingActionStatus,
  PendingActionType,
  Prisma,
} from '@prisma/client';
import { Job as QueueJob, Queue, Worker } from 'bullmq';
import { ChatService } from 'src/chat/chat.service';
import { EventsService } from 'src/chat/events.service';
import { containsText, JobPageQueryDto, paginate } from 'src/common/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { queueOptions } from 'src/queue/redis-options';
import { DraftingService } from './drafting.service';
import { MailerService } from './mailer.service';

const QUEUE_NAME = 'outreach';
const DISPATCH_EVERY_MS = 5000;
const DEFAULT_DAY_SECONDS = 86_400;
const SEND_CONCURRENCY = 3;

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true,
  removeOnFail: true,
};

// A candidate in any of these is already spoken for, so no one gets two campaigns
const ACTIVE_STATUSES: CampaignStatus[] = [
  CampaignStatus.DRAFTING,
  CampaignStatus.DRAFT,
  CampaignStatus.SENDING,
  CampaignStatus.PAUSED,
];

// Checked at send time, because a status can change after the drafts were approved
const NEVER_EMAIL: CandidateStatus[] = [
  CandidateStatus.REJECTED,
  CandidateStatus.UNSUBSCRIBED,
];

const UNSENT_STATUSES: EmailStatus[] = [EmailStatus.APPROVED, EmailStatus.SENDING];

// Drafting is left out, because the draft job would bring a stopped campaign back
export const CHANGEABLE_STATUSES: CampaignStatus[] = [
  CampaignStatus.DRAFT,
  CampaignStatus.SENDING,
  CampaignStatus.PAUSED,
];

export const CHANGE_NEEDS_STATUS: Record<CampaignChange, CampaignStatus[]> = {
  PAUSE: [CampaignStatus.SENDING],
  RESUME: [CampaignStatus.PAUSED],
  STOP: CHANGEABLE_STATUSES,
};

const CHANGE_LABELS: Record<CampaignChange, string> = {
  PAUSE: 'Paused',
  RESUME: 'Resumed',
  STOP: 'Stopped',
};

type OutreachPayload = { campaignId?: string; emailId?: string };

export type NewCampaign = {
  conversationId: string;
  jobId: string;
  name: string;
  dayOffsets: number[];
  dailyLimit: number;
  instructions: string | null;
  senderName: string;
  candidateIds: string[];
};

@Injectable()
export class OutreachService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutreachService.name);
  private queue: Queue<OutreachPayload>;
  private worker: Worker<OutreachPayload>;
  private lastWorkerError: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly events: EventsService,
    private readonly drafting: DraftingService,
    private readonly mailer: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const options = queueOptions(this.configService);

    this.queue = new Queue(QUEUE_NAME, options);
    this.worker = new Worker<OutreachPayload>(
      QUEUE_NAME,
      (job) => this.process(job),
      { ...options, concurrency: SEND_CONCURRENCY },
    );

    this.worker.on('failed', (job, error) => {
      void this.handleJobFailure(job, error);
    });
    this.worker.on('error', (error) => {
      if (error.message === this.lastWorkerError) return;
      this.lastWorkerError = error.message;
      this.logger.error(error.message);
    });

    await this.queue.upsertJobScheduler(
      'dispatch',
      { every: DISPATCH_EVERY_MS },
      { name: 'dispatch', opts: { removeOnComplete: true, removeOnFail: true } },
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }

  private get dayMs() {
    const seconds = Number(
      this.configService.get('OUTREACH_DAY_SECONDS') ?? DEFAULT_DAY_SECONDS,
    );
    return seconds * 1000;
  }

  private process(job: QueueJob<OutreachPayload>) {
    switch (job.name) {
      case 'draft':
        return this.draftCampaign(job.data.campaignId ?? '');
      case 'dispatch':
        return this.dispatch();
      case 'send':
        return this.sendEmail(job.data.emailId ?? '');
      default:
        throw new Error(`Unknown outreach job: ${job.name}`);
    }
  }

  // Only accepted candidates with an email who aren't already in a live campaign
  eligibleCandidates(jobId: string) {
    return this.prisma.candidate.findMany({
      where: {
        jobId,
        status: CandidateStatus.ACCEPTED,
        email: { not: null },
        recipients: { none: { campaign: { status: { in: ACTIVE_STATUSES } } } },
      },
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
  }

  // Says which campaigns hold the accepted candidates, so "nobody to contact" isn't a dead end
  campaignsHoldingCandidates(jobId: string) {
    return this.prisma.campaign.findMany({
      where: {
        jobId,
        status: { in: ACTIVE_STATUSES },
        recipients: {
          some: {
            candidate: {
              status: CandidateStatus.ACCEPTED,
              email: { not: null },
            },
          },
        },
      },
      select: { name: true, status: true },
    });
  }

  async createCampaign(input: NewCampaign) {
    const eligible = await this.eligibleCandidates(input.jobId);
    const allowed = new Set(input.candidateIds);
    const candidates = eligible.filter(({ id }) => allowed.has(id));

    if (candidates.length === 0) {
      throw new ConflictException('No eligible candidates are left for this campaign');
    }

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          jobId: input.jobId,
          conversationId: input.conversationId,
          name: input.name,
          dailyLimit: input.dailyLimit,
          instructions: input.instructions,
          senderName: input.senderName,
          steps: {
            create: input.dayOffsets.map((dayOffset, position) => ({
              position,
              dayOffset,
            })),
          },
          recipients: {
            create: candidates.map(({ id }) => ({ candidateId: id })),
          },
        },
      });

      await tx.activityLog.create({
        data: {
          jobId: input.jobId,
          actor: ActivityActor.RECRUITER,
          type: ActivityType.CAMPAIGN_CREATED,
          summary: `Created ${input.name} for ${candidates.length} candidates`,
        },
      });

      return created;
    });

    await this.chat.appendMessage(input.conversationId, {
      role: MessageRole.ASSISTANT,
      content:
        candidates.length === 1
          ? 'Writing a personal draft for this candidate.'
          : `Writing a personal draft for each of the ${candidates.length} candidates.`,
      cardType: CardType.CAMPAIGN_DRAFTS,
      campaignId: campaign.id,
    });

    await this.queue.add('draft', { campaignId: campaign.id }, JOB_OPTIONS);
    return campaign;
  }

  private async draftCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        job: true,
        steps: { orderBy: { position: 'asc' } },
        recipients: { include: { candidate: true } },
      },
    });

    for (const { candidate } of campaign.recipients) {
      // Lets a retry carry on without paying for finished drafts twice
      const done = await this.prisma.outboundEmail.count({
        where: {
          candidateId: candidate.id,
          campaignStep: { campaignId },
        },
      });
      if (done === campaign.steps.length) continue;

      const emails = await this.drafting.write({
        job: campaign.job,
        candidate,
        steps: campaign.steps,
        senderName: campaign.senderName,
        instructions: campaign.instructions,
      });

      await this.prisma.outboundEmail.createMany({
        data: emails.map((email, index) => ({
          ...email,
          campaignStepId: campaign.steps[index].id,
          candidateId: candidate.id,
        })),
        skipDuplicates: true,
      });

      this.events.publish(campaign.conversationId, { type: 'changed' });
    }

    const action = await this.prisma.pendingAction.create({
      data: {
        conversationId: campaign.conversationId,
        type: PendingActionType.SEND_CAMPAIGN,
        jobId: campaign.jobId,
        campaignId,
      },
    });

    await this.prisma.$transaction([
      this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.DRAFT },
      }),
      this.prisma.message.updateMany({
        where: { campaignId, cardType: CardType.CAMPAIGN_DRAFTS },
        data: {
          pendingActionId: action.id,
          content:
            'The drafts are ready. Check and edit them, then approve. Nothing is sent until you do.',
        },
      }),
    ]);

    this.events.publish(campaign.conversationId, { type: 'changed' });
  }

  // Called from the confirm path only, so this is the one way a campaign can start
  async approve(campaignId: string) {
    const { count } = await this.prisma.campaign.updateMany({
      where: { id: campaignId, status: CampaignStatus.DRAFT },
      data: { status: CampaignStatus.SENDING },
    });

    if (count === 0) {
      throw new ConflictException('This campaign is not waiting for approval');
    }

    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { steps: true },
    });

    const startsAt = Date.now();
    await this.prisma.$transaction([
      ...campaign.steps.map((step) =>
        this.prisma.outboundEmail.updateMany({
          where: { campaignStepId: step.id, status: EmailStatus.DRAFT },
          data: {
            status: EmailStatus.APPROVED,
            dueAt: new Date(startsAt + step.dayOffset * this.dayMs),
          },
        }),
      ),
      this.prisma.activityLog.create({
        data: {
          jobId: campaign.jobId,
          actor: ActivityActor.RECRUITER,
          type: ActivityType.CAMPAIGN_APPROVED,
          summary: `Approved ${campaign.name}`,
        },
      }),
    ]);

    await this.chat.appendMessage(campaign.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `Approved. Sending has started, with a limit of ${campaign.dailyLimit} emails a day.`,
      cardType: CardType.CAMPAIGN_PROGRESS,
      campaignId,
    });

    await this.queue.add('dispatch', {}, { removeOnComplete: true, removeOnFail: true });
  }

  async discard(campaignId: string) {
    await this.prisma.campaign.updateMany({
      where: { id: campaignId, status: CampaignStatus.DRAFT },
      data: { status: CampaignStatus.CANCELLED },
    });
  }

  // Picks what is due and within today's limit. Only `send` jobs touch the mail server.
  private async dispatch() {
    const campaigns = await this.prisma.campaign.findMany({
      where: { status: CampaignStatus.SENDING },
    });

    for (const campaign of campaigns) {
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.dayMs);

      const used = await this.prisma.outboundEmail.count({
        where: {
          campaignStep: { campaignId: campaign.id },
          OR: [
            { status: EmailStatus.SENT, sentAt: { gte: windowStart } },
            { status: EmailStatus.SENDING },
          ],
        },
      });

      const allowance = campaign.dailyLimit - used;
      if (allowance > 0) {
        const due = await this.prisma.outboundEmail.findMany({
          where: {
            campaignStep: { campaignId: campaign.id },
            status: EmailStatus.APPROVED,
            dueAt: { lte: now },
            candidate: {
              recipients: { some: { campaignId: campaign.id, stoppedAt: null } },
            },
          },
          orderBy: { dueAt: 'asc' },
          take: allowance,
          select: { id: true },
        });

        // The job id makes re-dispatching an email that's already queued harmless
        await Promise.all(
          due.map(({ id }) =>
            this.queue.add('send', { emailId: id }, { ...JOB_OPTIONS, jobId: `send-${id}` }),
          ),
        );
      }

      await this.completeIfFinished(campaign.id);
    }
  }

  private async sendEmail(emailId: string) {
    // The atomic claim is what stops a retry or a second worker sending it twice
    const { count } = await this.prisma.outboundEmail.updateMany({
      where: {
        id: emailId,
        status: EmailStatus.APPROVED,
        campaignStep: { campaign: { status: CampaignStatus.SENDING } },
      },
      data: { status: EmailStatus.SENDING },
    });
    if (count === 0) return;

    const email = await this.prisma.outboundEmail.findUniqueOrThrow({
      where: { id: emailId },
      include: { candidate: true, campaignStep: { include: { campaign: true } } },
    });
    const { campaign } = email.campaignStep;

    const recipient = await this.prisma.campaignRecipient.findUnique({
      where: {
        campaignId_candidateId: {
          campaignId: campaign.id,
          candidateId: email.candidateId,
        },
      },
    });

    if (
      !email.candidate.email ||
      !recipient ||
      recipient.stoppedAt ||
      NEVER_EMAIL.includes(email.candidate.status)
    ) {
      await this.prisma.outboundEmail.update({
        where: { id: emailId },
        data: { status: EmailStatus.STOPPED },
      });
      return;
    }

    let result: Awaited<ReturnType<MailerService['send']>>;
    try {
      result = await this.mailer.send({
        to: email.candidate.email,
        senderName: campaign.senderName,
        subject: email.subject,
        body: email.body,
      });
    } catch (error) {
      // Nothing was delivered, so handing it back for the retry is safe
      await this.prisma.outboundEmail.update({
        where: { id: emailId },
        data: { status: EmailStatus.APPROVED },
      });
      throw error;
    }

    await this.markSent(emailId, email.candidate, campaign, result);
  }

  private async markSent(
    emailId: string,
    candidate: { id: string; name: string | null; status: CandidateStatus },
    campaign: { id: string; jobId: string; conversationId: string },
    result: Awaited<ReturnType<MailerService['send']>>,
  ) {
    const isFirstContact = candidate.status === CandidateStatus.ACCEPTED;

    await this.prisma.$transaction([
      this.prisma.outboundEmail.update({
        where: { id: emailId },
        data: { status: EmailStatus.SENT, sentAt: new Date(), ...result },
      }),
      this.prisma.activityLog.create({
        data: {
          jobId: campaign.jobId,
          candidateId: candidate.id,
          actor: ActivityActor.SYSTEM,
          type: ActivityType.EMAIL_SENT,
          summary: `Emailed ${candidate.name ?? 'a candidate'}`,
        },
      }),
      ...(isFirstContact
        ? [
            this.prisma.candidate.update({
              where: { id: candidate.id },
              data: { status: CandidateStatus.CONTACTED },
            }),
            this.prisma.activityLog.create({
              data: {
                jobId: campaign.jobId,
                candidateId: candidate.id,
                actor: ActivityActor.SYSTEM,
                type: ActivityType.CANDIDATE_STATUS_CHANGED,
                fromStatus: CandidateStatus.ACCEPTED,
                toStatus: CandidateStatus.CONTACTED,
                summary: `${candidate.name ?? 'A candidate'} was contacted`,
              },
            }),
          ]
        : []),
    ]);

    this.events.publish(campaign.conversationId, { type: 'changed' });
    await this.completeIfFinished(campaign.id);
  }

  // A reply or unsubscribe ends this candidate's sequence in every campaign
  async stopFollowUps(candidateId: string) {
    await this.prisma.$transaction([
      this.prisma.campaignRecipient.updateMany({
        where: { candidateId, stoppedAt: null },
        data: { stoppedAt: new Date() },
      }),
      this.prisma.outboundEmail.updateMany({
        where: { candidateId, status: EmailStatus.APPROVED },
        data: { status: EmailStatus.STOPPED },
      }),
    ]);

    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { candidateId },
      select: { campaign: { select: { id: true, conversationId: true } } },
    });

    for (const { campaign } of recipients) {
      this.events.publish(campaign.conversationId, { type: 'changed' });
      await this.completeIfFinished(campaign.id);
    }
  }

  private async completeIfFinished(campaignId: string) {
    const remaining = await this.prisma.outboundEmail.count({
      where: {
        campaignStep: { campaignId },
        status: { in: UNSENT_STATUSES },
        candidate: { recipients: { some: { campaignId, stoppedAt: null } } },
      },
    });
    if (remaining > 0) return;

    const { count } = await this.prisma.campaign.updateMany({
      where: { id: campaignId, status: CampaignStatus.SENDING },
      data: { status: CampaignStatus.COMPLETED },
    });
    if (count === 0) return;

    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
    });
    const [sent, failed, stopped] = await Promise.all(
      [EmailStatus.SENT, EmailStatus.FAILED, EmailStatus.STOPPED].map((status) =>
        this.prisma.outboundEmail.count({
          where: { campaignStep: { campaignId }, status },
        }),
      ),
    );

    const details = [
      failed > 0 && `${failed} failed`,
      stopped > 0 && `${stopped} stopped because the candidate replied`,
    ].filter(Boolean);

    await this.chat.appendMessage(campaign.conversationId, {
      role: MessageRole.ASSISTANT,
      content:
        details.length > 0
          ? `${campaign.name} finished. ${sent} emails were sent, ${details.join(', and ')}.`
          : `${campaign.name} finished. All ${sent} emails were sent.`,
    });
  }

  private async handleJobFailure(
    job: QueueJob<OutreachPayload> | undefined,
    error: Error,
  ) {
    this.logger.error(`Outreach job failed: ${error.message}`);

    // Earlier attempts will retry, so only the last failure is recorded
    if (!job || job.name === 'dispatch') return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;

    if (job.name === 'send' && job.data.emailId) {
      const email = await this.prisma.outboundEmail.update({
        where: { id: job.data.emailId },
        data: { status: EmailStatus.FAILED, error: error.message },
        include: { campaignStep: { include: { campaign: true } } },
      });
      const { campaign } = email.campaignStep;
      this.events.publish(campaign.conversationId, { type: 'changed' });
      await this.completeIfFinished(campaign.id);
    }

    if (job.name === 'draft' && job.data.campaignId) {
      const campaign = await this.prisma.campaign.update({
        where: { id: job.data.campaignId },
        data: { status: CampaignStatus.FAILED, error: error.message },
      });
      await this.chat.appendMessage(campaign.conversationId, {
        role: MessageRole.ASSISTANT,
        content: `I couldn't finish the drafts after several tries, so nothing was sent. Please ask me to try again.`,
      });
    }
  }

  private async findOwned(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, job: { userId } },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  async listCampaigns(
    userId: string,
    query: JobPageQueryDto & { status?: CampaignStatus },
  ) {
    const { search, status, jobId } = query;
    const text = search ? containsText(search) : undefined;

    const where: Prisma.CampaignWhereInput = {
      job: { userId },
      jobId,
      status,
      ...(text && { OR: [{ name: text }, { job: { title: text } }] }),
    };

    const page = await paginate(
      query,
      await this.prisma.campaign.count({ where }),
      (range) =>
        this.prisma.campaign.findMany({
          ...range,
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            status: true,
            dailyLimit: true,
            conversationId: true,
            createdAt: true,
            job: { select: { id: true, title: true } },
            steps: { select: { id: true } },
            _count: { select: { recipients: true } },
          },
        }),
    );

    // Grouped in one query, so a page never loads every email it's counting
    const counts = await this.prisma.outboundEmail.groupBy({
      by: ['campaignStepId', 'status'],
      where: {
        campaignStepId: {
          in: page.items.flatMap(({ steps }) => steps.map(({ id }) => id)),
        },
      },
      _count: true,
    });

    return {
      ...page,
      items: page.items.map(({ steps, _count, ...campaign }) => {
        const stepIds = new Set(steps.map(({ id }) => id));
        const rows = counts.filter(({ campaignStepId }) =>
          stepIds.has(campaignStepId),
        );
        const countOf = (wanted?: EmailStatus) =>
          rows
            .filter(({ status }) => !wanted || status === wanted)
            .reduce((total, row) => total + row._count, 0);

        return {
          ...campaign,
          recipients: _count.recipients,
          emails: {
            total: countOf(),
            sent: countOf(EmailStatus.SENT),
            failed: countOf(EmailStatus.FAILED),
            stopped: countOf(EmailStatus.STOPPED),
          },
        };
      }),
    };
  }

  async getCampaign(campaignId: string, userId: string) {
    await this.findOwned(campaignId, userId);

    return this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        steps: { orderBy: { position: 'asc' } },
        recipients: {
          select: {
            stoppedAt: true,
            candidate: {
              select: { id: true, name: true, email: true, status: true },
            },
          },
        },
        job: { select: { title: true } },
      },
    });
  }

  listEmails(campaignId: string) {
    return this.prisma.outboundEmail.findMany({
      where: { campaignStep: { campaignId } },
      orderBy: { campaignStep: { position: 'asc' } },
    });
  }

  async updateDraft(
    campaignId: string,
    emailId: string,
    userId: string,
    data: { subject?: string; body?: string },
  ) {
    await this.findOwned(campaignId, userId);

    const { count } = await this.prisma.outboundEmail.updateMany({
      where: {
        id: emailId,
        status: EmailStatus.DRAFT,
        campaignStep: { campaignId, campaign: { status: CampaignStatus.DRAFT } },
      },
      data,
    });

    if (count === 0) {
      throw new ConflictException('This email can no longer be edited');
    }
    return { success: true };
  }

  async setPaused(campaignId: string, userId: string, paused: boolean) {
    await this.findOwned(campaignId, userId);

    const { count } = await this.prisma.campaign.updateMany({
      where: {
        id: campaignId,
        status: paused ? CampaignStatus.SENDING : CampaignStatus.PAUSED,
      },
      data: { status: paused ? CampaignStatus.PAUSED : CampaignStatus.SENDING },
    });

    if (count === 0) {
      throw new ConflictException('This campaign can no longer be changed');
    }
    return { success: true };
  }

  // A send already claimed may finish, but stopping keeps anything else from going out
  private async stopCampaign(campaignId: string) {
    const { count } = await this.prisma.campaign.updateMany({
      where: { id: campaignId, status: { in: CHANGEABLE_STATUSES } },
      data: { status: CampaignStatus.CANCELLED },
    });

    if (count === 0) {
      throw new ConflictException('This campaign can no longer be stopped');
    }

    await this.prisma.$transaction([
      this.prisma.outboundEmail.updateMany({
        where: {
          campaignStep: { campaignId },
          status: { in: [EmailStatus.DRAFT, EmailStatus.APPROVED] },
        },
        data: { status: EmailStatus.STOPPED },
      }),
      this.prisma.pendingAction.updateMany({
        where: {
          campaignId,
          type: PendingActionType.SEND_CAMPAIGN,
          status: PendingActionStatus.PENDING,
        },
        data: {
          status: PendingActionStatus.CANCELLED,
          resolvedAt: new Date(),
        },
      }),
    ]);
  }

  // Called from the confirm path only, and the status goes first so a refused change
  // leaves the limit alone
  async applyChange(
    campaignId: string,
    userId: string,
    change: CampaignChange | null,
    dailyLimit: number | null,
  ) {
    const campaign = await this.findOwned(campaignId, userId);

    if (change === CampaignChange.STOP) {
      await this.stopCampaign(campaignId);
    } else if (change) {
      await this.setPaused(campaignId, userId, change === CampaignChange.PAUSE);
    }

    const newLimit = change === CampaignChange.STOP ? null : dailyLimit;
    if (newLimit) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { dailyLimit: newLimit },
      });
    }

    const summary = [
      change && `${CHANGE_LABELS[change]} ${campaign.name}`,
      newLimit && `${campaign.name} limit set to ${newLimit} a day`,
    ]
      .filter(Boolean)
      .join('. ');

    await this.prisma.activityLog.create({
      data: {
        jobId: campaign.jobId,
        actor: ActivityActor.RECRUITER,
        type: ActivityType.CAMPAIGN_CHANGED,
        summary,
      },
    });
    return summary;
  }

  jobCampaigns(jobId: string) {
    return this.prisma.campaign.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        status: true,
        steps: { select: { emails: { select: { status: true } } } },
      },
    });
  }
}
