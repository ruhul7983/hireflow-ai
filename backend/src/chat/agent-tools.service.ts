// src/chat/agent-tools.service.ts
import { tool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import {
  CampaignChange,
  CampaignStatus,
  CandidateStatus,
  Conversation,
  EmailStatus,
  RemotePolicy,
  ReplyDraftStatus,
} from '@prisma/client';
import {
  CampaignSetupService,
  validLimit,
} from 'src/campaign-setup/campaign-setup.service';
import { DashboardService } from 'src/dashboard/dashboard.service';
import { stripDelimiters } from 'src/llm/untrusted';
import {
  CHANGE_NEEDS_STATUS,
  CHANGEABLE_STATUSES,
  OutreachService,
} from 'src/outreach/outreach.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { z } from 'zod';
import { ActionsService, ProposedCard } from './actions.service';
import {
  nextStatuses,
  RECRUITER_TARGETS,
  statusLabel,
} from './candidate-status';
import { CandidatesService } from './candidates.service';
import { readPublicPage } from './url-reader';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;
const MAX_NAME_MATCHES = 6;
const MAX_SNIPPET_LENGTH = 300;

export type TurnState = {
  conversation: Conversation;
  userId: string;
  userMessage: string;
  fetchedText: string | null;
  cards: ProposedCard[];
  handedOff: boolean; // The setup posts its own messages, so the agent stays quiet
};

const proposeJobSchema = z.object({
  title: z.string().nullable(),
  seniority: z
    .string()
    .nullable()
    .describe('In normal capitalisation, such as Senior'),
  location: z.string().nullable(),
  salary: z
    .string()
    .nullable()
    .describe('As written in the text, including the currency'),
  remote_policy: z.enum(RemotePolicy).nullable(),
  must_have_skills: z.array(z.string()),
  nice_to_have_skills: z.array(z.string()),
  source_url: z.string().nullable(),
});

const listCandidatesSchema = z.object({
  status: z.enum(CandidateStatus).nullable(),
  limit: z.number().int().nullable(),
});

const proposeCandidateDecisionSchema = z.object({
  decision: z.enum([CandidateStatus.ACCEPTED, CandidateStatus.REJECTED]),
  candidate_ids: z
    .array(z.string())
    .describe('Ids from list_candidates. Empty when not used.'),
  top_n: z
    .number()
    .int()
    .nullable()
    .describe('The N highest scoring undecided candidates'),
  all_undecided: z
    .boolean()
    .describe('Every candidate still waiting for a decision'),
});

const startCampaignSetupSchema = z.object({
  day_offsets: z
    .array(z.number().int())
    .nullable()
    .describe(
      'Only if the recruiter stated the send days, such as [0, 3, 7]. Otherwise null.',
    ),
  daily_limit: z
    .number()
    .int()
    .nullable()
    .describe('Only if the recruiter stated a limit. Otherwise null.'),
  instructions: z
    .string()
    .nullable()
    .describe('Only if the recruiter stated a tone or focus. Otherwise null.'),
});

const proposeCampaignChangeSchema = z.object({
  campaign_id: z.string().describe('An id from list_campaigns'),
  change: z
    .enum([CampaignChange.PAUSE, CampaignChange.RESUME, CampaignChange.STOP])
    .nullable()
    .describe('Null when only the daily limit changes'),
  daily_limit: z
    .number()
    .int()
    .nullable()
    .describe('Only if the recruiter stated a new limit. Otherwise null.'),
});

const proposeJobUpdateSchema = z.object({
  title: z.string().nullable(),
  seniority: z.string().nullable(),
  location: z.string().nullable(),
  salary: z.string().nullable(),
  remote_policy: z.enum(RemotePolicy).nullable(),
  must_have_skills: z
    .array(z.string())
    .nullable()
    .describe('The full new list, if the skills change'),
  nice_to_have_skills: z
    .array(z.string())
    .nullable()
    .describe('The full new list, if the skills change'),
});

const proposeReplySendSchema = z.object({
  reply_id: z.string().describe('An id from list_replies'),
  new_draft: z
    .string()
    .nullable()
    .describe(
      'The full new reply, only if the recruiter asked to change it. Otherwise null.',
    ),
});

const proposeCandidateStatusChangeSchema = z.object({
  candidate_name: z
    .string()
    .describe('The name exactly as the recruiter said it'),
  status: z.enum(RECRUITER_TARGETS as [CandidateStatus, ...CandidateStatus[]]),
});

type ProposeJobArgs = z.infer<typeof proposeJobSchema>;
type ListCandidatesArgs = z.infer<typeof listCandidatesSchema>;
type ProposeCandidateDecisionArgs = z.infer<
  typeof proposeCandidateDecisionSchema
>;
type StartCampaignSetupArgs = z.infer<typeof startCampaignSetupSchema>;
type ProposeCampaignChangeArgs = z.infer<typeof proposeCampaignChangeSchema>;
type ProposeJobUpdateArgs = z.infer<typeof proposeJobUpdateSchema>;
type ProposeReplySendArgs = z.infer<typeof proposeReplySendSchema>;
type ProposeCandidateStatusChangeArgs = z.infer<
  typeof proposeCandidateStatusChangeSchema
>;

function untrusted(text: string) {
  return `<untrusted_content>\n${stripDelimiters(text)}\n</untrusted_content>`;
}

@Injectable()
export class AgentToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actions: ActionsService,
    private readonly candidates: CandidatesService,
    private readonly outreach: OutreachService,
    private readonly campaignSetup: CampaignSetupService,
    private readonly dashboard: DashboardService,
  ) {}

  // Tools are snake_case verb_noun names, and the verb says what a tool may do:
  // read_, list_ and get_ only look, propose_ only shows a card for the recruiter to
  // confirm, and start_ hands the turn to a guided flow. None of them can write directly.
  forTurn(state: TurnState) {
    return [
      tool(({ url }) => this.readJobPosting(url, state), {
        name: 'read_job_posting',
        description: 'Read the text of a job posting from a public link.',
        schema: z.object({ url: z.string() }),
      }),
      tool((args) => this.proposeJob(args, state), {
        name: 'propose_job',
        description:
          'Show the recruiter an editable draft of a job. Does not create the job.',
        schema: proposeJobSchema,
      }),
      tool(() => this.proposeSourcing(state), {
        name: 'propose_sourcing',
        description:
          'Ask the recruiter to confirm a web search for candidates for the current job.',
        schema: z.object({}),
      }),
      tool((args) => this.listCandidates(args, state), {
        name: 'list_candidates',
        description:
          'List candidates on the current job, highest score first, with their ids.',
        schema: listCandidatesSchema,
      }),
      tool((args) => this.proposeCandidateDecision(args, state), {
        name: 'propose_candidate_decision',
        description:
          'Ask the recruiter to confirm accepting or rejecting candidates on the current job. Set exactly one of candidate_ids, top_n or all_undecided.',
        schema: proposeCandidateDecisionSchema,
      }),
      tool((args) => this.proposeCandidateStatusChange(args, state), {
        name: 'propose_candidate_status_change',
        description:
          'Ask the recruiter to confirm moving one candidate to a new pipeline stage. Changes nothing until they confirm.',
        schema: proposeCandidateStatusChangeSchema,
      }),
      tool((args) => this.startCampaignSetup(args, state), {
        name: 'start_campaign_setup',
        description:
          'Start the guided setup for a new campaign, which asks the recruiter each decision with buttons. Writes and sends nothing.',
        schema: startCampaignSetupSchema,
      }),
      tool(() => this.listCampaigns(state), {
        name: 'list_campaigns',
        description:
          'List campaigns with their ids, statuses and how many emails were sent. Covers the current job, or every job if the chat has none.',
        schema: z.object({}),
      }),
      tool((args) => this.proposeCampaignChange(args, state), {
        name: 'propose_campaign_change',
        description:
          'Ask the recruiter to confirm pausing, resuming or stopping a campaign, changing its daily email limit, or resuming it with a new limit. STOP ends it for good and frees its candidates for a new campaign. Changes nothing until they confirm.',
        schema: proposeCampaignChangeSchema,
      }),
      tool(({ campaign_id }) => this.proposeCampaignSend(campaign_id, state), {
        name: 'propose_campaign_send',
        description:
          'Ask the recruiter to confirm approving a campaign whose drafts are ready, which starts sending. Sends nothing until they confirm.',
        schema: z.object({ campaign_id: z.string() }),
      }),
      tool(({ campaign_id }) => this.getCampaignDetails(campaign_id, state), {
        name: 'get_campaign_details',
        description:
          'Show who is in a campaign and the status of each of their emails.',
        schema: z.object({ campaign_id: z.string() }),
      }),
      tool(() => this.listReplies(state), {
        name: 'list_replies',
        description:
          'List recent candidate replies with their ids, classification and draft responses. Covers the current job, or every job if the chat has none.',
        schema: z.object({}),
      }),
      tool((args) => this.proposeReplySend(args, state), {
        name: 'propose_reply_send',
        description:
          'Ask the recruiter to confirm sending the drafted response to a candidate reply, with an optional rewrite. Sends nothing until they confirm.',
        schema: proposeReplySendSchema,
      }),
      tool(() => this.proposeCandidateScoring(state), {
        name: 'propose_candidate_scoring',
        description:
          'Ask the recruiter to confirm scoring candidates on the current job who have no score yet. Normal sourcing scores everyone by itself, so this is only for a failed run.',
        schema: z.object({}),
      }),
      tool(({ candidate_name }) => this.getCandidateDetails(candidate_name, state), {
        name: 'get_candidate_details',
        description:
          'Look up a candidate by name: their id, job, status, score, reason, latest reply, meeting and allowed next stages.',
        schema: z.object({
          candidate_name: z
            .string()
            .describe('The name exactly as the recruiter said it'),
        }),
      }),
      tool(({ job_id }) => this.getJobDetails(job_id, state), {
        name: 'get_job_details',
        description:
          'Get the saved details of a job. Uses the current job when job_id is null.',
        schema: z.object({ job_id: z.string().nullable() }),
      }),
      tool((args) => this.proposeJobUpdate(args, state), {
        name: 'propose_job_update',
        description:
          'Show the recruiter an editable card with changes to the current job. Set only what changes, and null for the rest. Changes nothing until they save it.',
        schema: proposeJobUpdateSchema,
      }),
      tool(({ enabled }) => this.proposeAutoReplyChange(enabled, state), {
        name: 'propose_auto_reply_change',
        description:
          'Ask the recruiter to confirm turning auto-reply on or off for the current job.',
        schema: z.object({ enabled: z.boolean() }),
      }),
      tool(() => this.listMeetings(state), {
        name: 'list_meetings',
        description:
          'List meetings with their times and candidates, soonest first. Covers the current job, or every job if the chat has none.',
        schema: z.object({}),
      }),
      tool(({ limit }) => this.listActivity(limit, state), {
        name: 'list_activity',
        description:
          'List recent changes from the activity log, newest first. Covers the current job, or every job if the chat has none.',
        schema: z.object({ limit: z.number().int().nullable() }),
      }),
      tool(() => this.listPendingApprovals(state), {
        name: 'list_pending_approvals',
        description: 'List everything waiting for the recruiter, across all jobs.',
        schema: z.object({}),
      }),
      tool(() => this.listJobs(state), {
        name: 'list_jobs',
        description: "List the recruiter's jobs with their ids.",
        schema: z.object({}),
      }),
      tool(({ job_id }) => this.getJobStats(job_id, state), {
        name: 'get_job_stats',
        description:
          'Get real progress numbers for a job. Uses the current job when job_id is null.',
        schema: z.object({ job_id: z.string().nullable() }),
      }),
    ];
  }

  private async readJobPosting(url: string, state: TurnState) {
    try {
      const text = await readPublicPage(url);
      if (text.length < 100) {
        return 'The page had almost no readable text. Ask the recruiter to paste the job description.';
      }
      state.fetchedText = text;
      return untrusted(text);
    } catch (error) {
      return `Could not read that link (${(error as Error).message}). Ask the recruiter to paste the job description.`;
    }
  }

  private async proposeJob(args: ProposeJobArgs, state: TurnState) {
    const card = await this.actions.proposeJob(state.conversation.id, {
      title: args.title,
      seniority: args.seniority,
      location: args.location,
      salary: args.salary,
      remotePolicy: args.remote_policy,
      mustHaveSkills: args.must_have_skills,
      niceToHaveSkills: args.nice_to_have_skills,
      description: state.fetchedText ?? state.userMessage,
      sourceUrl: args.source_url,
    });

    state.cards.push(card);
    return 'The draft card is showing. Ask the recruiter to review and confirm it.';
  }

  private async proposeSourcing(state: TurnState) {
    if (!state.conversation.jobId) {
      return 'There is no job in this chat yet, so sourcing cannot start.';
    }

    state.cards.push(
      await this.actions.proposeSourcing(
        state.conversation.id,
        state.conversation.jobId,
      ),
    );
    return 'The confirmation card is showing. Sourcing starts only if they confirm.';
  }

  private async listCandidates(args: ListCandidatesArgs, state: TurnState) {
    if (!state.conversation.jobId) return 'There is no job in this chat yet.';

    const candidates = await this.prisma.candidate.findMany({
      where: {
        jobId: state.conversation.jobId,
        ...(args.status ? { status: args.status } : {}),
      },
      orderBy: [
        { score: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
      take: Math.min(args.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT),
    });

    if (candidates.length === 0) return 'No candidates match that.';

    return untrusted(
      candidates
        .map(
          (candidate) =>
            `id=${candidate.id} | ${candidate.name ?? 'Name unknown'} | score ${candidate.score ?? 'none'} | ${candidate.status} | email ${candidate.email ? 'yes' : 'no'} | ${candidate.headline ?? 'no headline'}`,
        )
        .join('\n'),
    );
  }

  private async proposeCandidateDecision(
    args: ProposeCandidateDecisionArgs,
    state: TurnState,
  ) {
    const jobId = state.conversation.jobId;
    if (!jobId) return 'There is no job in this chat yet.';

    const undecided = { jobId, status: CandidateStatus.SOURCED };

    let candidates: { id: string }[];
    if (args.candidate_ids.length > 0) {
      // Keeps only real ids on this job, whatever the model passed in
      candidates = await this.prisma.candidate.findMany({
        where: { id: { in: args.candidate_ids }, jobId },
        select: { id: true },
      });
    } else if (args.top_n) {
      candidates = await this.prisma.candidate.findMany({
        where: { ...undecided, score: { not: null } },
        orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
        take: args.top_n,
        select: { id: true },
      });
    } else if (args.all_undecided) {
      candidates = await this.prisma.candidate.findMany({
        where: undecided,
        select: { id: true },
      });
    } else {
      return 'Say which candidates: candidate_ids, top_n or all_undecided.';
    }

    if (candidates.length === 0) return 'No candidates match that.';

    state.cards.push(
      await this.actions.proposeDecision(
        state.conversation.id,
        jobId,
        args.decision,
        candidates.map(({ id }) => id),
      ),
    );
    return `The confirmation card is showing for ${candidates.length} candidates. Nothing changes until they confirm.`;
  }

  private async startCampaignSetup(
    args: StartCampaignSetupArgs,
    state: TurnState,
  ) {
    // Starting again would throw away the answers already given
    if (await this.campaignSetup.pendingQuestion(state.conversation.id)) {
      return 'A setup is already waiting on the recruiter. Ask them to pick a button.';
    }

    await this.campaignSetup.start(state.conversation.id, state.userId, {
      dayOffsets: args.day_offsets,
      dailyLimit: args.daily_limit,
      instructions: args.instructions ?? undefined,
    });

    state.handedOff = true;
    return 'The setup is asking the recruiter.';
  }

  private async listCampaigns(state: TurnState) {
    const { jobId } = state.conversation;

    const campaigns = await this.prisma.campaign.findMany({
      where: { job: { userId: state.userId }, ...(jobId ? { jobId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: DEFAULT_LIST_LIMIT,
      select: {
        id: true,
        name: true,
        status: true,
        dailyLimit: true,
        job: { select: { title: true } },
        steps: { select: { emails: { select: { status: true } } } },
      },
    });

    if (campaigns.length === 0) return 'There are no campaigns yet.';

    return untrusted(
      campaigns
        .map(({ id, name, status, dailyLimit, job, steps }) => {
          const emails = steps.flatMap((step) => step.emails);
          const sent = emails.filter(
            (email) => email.status === EmailStatus.SENT,
          ).length;

          return `id=${id} | ${name} | ${status} | ${job.title} | ${sent} of ${emails.length} emails sent | limit ${dailyLimit} a day`;
        })
        .join('\n'),
    );
  }

  private async proposeCampaignSend(campaignId: string, state: TurnState) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, job: { userId: state.userId } },
    });

    if (!campaign) {
      return 'That campaign was not found. Call list_campaigns to get its id.';
    }
    if (campaign.status === CampaignStatus.DRAFTING) {
      return 'The drafts are still being written. Tell the recruiter to wait for them.';
    }
    if (!CHANGE_NEEDS_STATUS.SEND.includes(campaign.status)) {
      return `${campaign.name} is ${campaign.status.toLowerCase()}, so it isn't waiting for approval.`;
    }

    state.cards.push(
      await this.actions.proposeCampaignChange(
        state.conversation.id,
        campaign,
        CampaignChange.SEND,
        null,
      ),
    );
    return 'The confirmation card is showing. Nothing is sent until they confirm.';
  }

  private async getCampaignDetails(campaignId: string, state: TurnState) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, job: { userId: state.userId } },
      select: {
        name: true,
        status: true,
        recipients: {
          select: {
            stoppedAt: true,
            candidate: {
              select: {
                name: true,
                status: true,
                emails: {
                  where: { campaignStep: { campaignId } },
                  select: {
                    status: true,
                    campaignStep: { select: { dayOffset: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      return 'That campaign was not found. Call list_campaigns to get its id.';
    }

    const rows = campaign.recipients.map(({ stoppedAt, candidate }) => {
      const emails = candidate.emails
        .map(
          ({ status, campaignStep }) =>
            `day ${campaignStep.dayOffset} ${status}`,
        )
        .join(', ');

      return `${candidate.name ?? 'Name unknown'} | ${candidate.status} | ${emails || 'no emails'}${stoppedAt ? ' | follow-ups stopped' : ''}`;
    });

    return untrusted(
      [`${campaign.name} is ${campaign.status}.`, ...rows].join('\n'),
    );
  }

  private scope(state: TurnState) {
    const { jobId } = state.conversation;
    return { job: { userId: state.userId }, ...(jobId ? { jobId } : {}) };
  }

  private async listReplies(state: TurnState) {
    const replies = await this.prisma.candidateReply.findMany({
      where: { candidate: this.scope(state) },
      orderBy: { receivedAt: 'desc' },
      take: DEFAULT_LIST_LIMIT,
      select: {
        id: true,
        body: true,
        classification: true,
        draftBody: true,
        draftStatus: true,
        candidate: { select: { name: true } },
      },
    });

    if (replies.length === 0) return 'There are no candidate replies yet.';

    return untrusted(
      replies
        .map(
          (reply) =>
            `id=${reply.id} | ${reply.candidate.name ?? 'Name unknown'} | ${reply.classification ?? 'not read yet'} | draft ${reply.draftStatus ?? 'none'} | they said: ${reply.body.slice(0, MAX_SNIPPET_LENGTH)} | draft: ${reply.draftBody?.slice(0, MAX_SNIPPET_LENGTH) ?? 'none'}`,
        )
        .join('\n'),
    );
  }

  private async proposeReplySend(
    args: ProposeReplySendArgs,
    state: TurnState,
  ) {
    const reply = await this.prisma.candidateReply.findFirst({
      where: { id: args.reply_id, candidate: { job: { userId: state.userId } } },
      include: { candidate: { select: { name: true, jobId: true } } },
    });

    if (!reply) {
      return 'That reply was not found. Call list_replies to get its id.';
    }

    const draft = args.new_draft?.trim() || reply.draftBody;
    if (reply.draftStatus !== ReplyDraftStatus.PENDING_APPROVAL || !draft) {
      return `That reply isn't waiting to be sent. Its draft is ${reply.draftStatus?.toLowerCase() ?? 'missing'}.`;
    }

    state.cards.push(
      await this.actions.proposeReplySend(
        state.conversation.id,
        {
          id: reply.id,
          jobId: reply.candidate.jobId,
          candidateName: reply.candidate.name,
        },
        draft,
      ),
    );
    return 'The confirmation card is showing. Nothing is sent until they confirm.';
  }

  private async proposeCandidateScoring(state: TurnState) {
    const { jobId } = state.conversation;
    if (!jobId) return 'There is no job in this chat yet.';

    const count = await this.prisma.candidate.count({
      where: { jobId, score: null, sourcingRunId: { not: null } },
    });
    if (count === 0) return 'Every candidate on this job has a score already.';

    state.cards.push(
      await this.actions.proposeScoring(state.conversation.id, jobId, count),
    );
    return 'The confirmation card is showing. Scoring starts only if they confirm.';
  }

  private async getCandidateDetails(name: string, state: TurnState) {
    const matches = await this.prisma.candidate.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        ...this.scope(state),
      },
      take: MAX_NAME_MATCHES,
      include: {
        job: { select: { title: true } },
        replies: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
          select: { classification: true, body: true },
        },
        meetings: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, startsAt: true },
        },
      },
    });

    if (matches.length === 0) {
      return `Nobody called ${name} was found. Say so, and don't guess.`;
    }

    return untrusted(
      matches
        .map((candidate) => {
          const [reply] = candidate.replies;
          const [meeting] = candidate.meetings;

          return [
            `id=${candidate.id}`,
            candidate.name ?? 'Name unknown',
            candidate.job.title,
            candidate.status,
            `score ${candidate.score ?? 'none'}: ${candidate.scoreReason ?? 'not scored'}`,
            `email ${candidate.email ?? 'unknown'}`,
            candidate.headline ?? 'no headline',
            candidate.location ?? 'location unknown',
            `latest reply: ${reply ? `${reply.classification ?? 'not read yet'}, ${reply.body.slice(0, MAX_SNIPPET_LENGTH)}` : 'none'}`,
            `meeting: ${meeting ? `${meeting.status} ${meeting.startsAt?.toISOString() ?? 'no time yet'}` : 'none'}`,
            `allowed next: ${nextStatuses(candidate.status).join(', ') || 'none'}`,
          ].join(' | ');
        })
        .join('\n'),
    );
  }

  private async getJobDetails(jobId: string | null, state: TurnState) {
    const targetId = jobId ?? state.conversation.jobId;
    if (!targetId) return 'There is no job in this chat yet.';

    const job = await this.candidates.assertJobOwned(targetId, state.userId);

    return untrusted(
      [
        `${job.title} (id ${job.id}), ${job.status}`,
        `Seniority: ${job.seniority ?? 'not set'}`,
        `Location: ${job.location ?? 'not set'}`,
        `Work mode: ${job.remotePolicy ?? 'not set'}`,
        `Salary: ${job.salary ?? 'not set'}`,
        `Must have: ${job.mustHaveSkills.join(', ') || 'none'}`,
        `Nice to have: ${job.niceToHaveSkills.join(', ') || 'none'}`,
        `Auto-reply: ${job.autoReply ? 'on' : 'off'}`,
      ].join('\n'),
    );
  }

  private async proposeJobUpdate(
    args: ProposeJobUpdateArgs,
    state: TurnState,
  ) {
    const { jobId } = state.conversation;
    if (!jobId) return 'There is no job in this chat yet.';

    const job = await this.candidates.assertJobOwned(jobId, state.userId);

    state.cards.push(
      await this.actions.proposeJobUpdate(state.conversation.id, jobId, {
        title: args.title ?? job.title,
        seniority: args.seniority ?? job.seniority,
        location: args.location ?? job.location,
        salary: args.salary ?? job.salary,
        remotePolicy: args.remote_policy ?? job.remotePolicy,
        mustHaveSkills: args.must_have_skills ?? job.mustHaveSkills,
        niceToHaveSkills: args.nice_to_have_skills ?? job.niceToHaveSkills,
        description: job.description,
        sourceUrl: job.sourceUrl,
      }),
    );
    return 'The editable card is showing. Nothing changes until they save it.';
  }

  private async proposeAutoReplyChange(enabled: boolean, state: TurnState) {
    const { jobId } = state.conversation;
    if (!jobId) return 'There is no job in this chat yet.';

    const job = await this.candidates.assertJobOwned(jobId, state.userId);
    if (job.autoReply === enabled) {
      return `Auto-reply is already ${enabled ? 'on' : 'off'} for this job.`;
    }

    state.cards.push(
      await this.actions.proposeAutoReplyChange(
        state.conversation.id,
        job,
        enabled,
      ),
    );
    return 'The confirmation card is showing. Nothing changes until they confirm.';
  }

  private async listMeetings(state: TurnState) {
    const meetings = await this.prisma.meeting.findMany({
      where: { candidate: this.scope(state) },
      orderBy: { startsAt: { sort: 'asc', nulls: 'last' } },
      take: DEFAULT_LIST_LIMIT,
      select: {
        status: true,
        startsAt: true,
        candidate: {
          select: { name: true, job: { select: { title: true } } },
        },
      },
    });

    if (meetings.length === 0) return 'There are no meetings yet.';

    return untrusted(
      meetings
        .map(
          ({ status, startsAt, candidate }) =>
            `${candidate.name ?? 'Name unknown'} | ${candidate.job.title} | ${status} | ${startsAt?.toISOString() ?? 'no time picked'}`,
        )
        .join('\n'),
    );
  }

  private async listActivity(limit: number | null, state: TurnState) {
    const entries = await this.prisma.activityLog.findMany({
      where: this.scope(state),
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT),
      select: {
        actor: true,
        summary: true,
        createdAt: true,
        job: { select: { title: true } },
      },
    });

    if (entries.length === 0) return 'Nothing has happened yet.';

    return untrusted(
      entries
        .map(
          ({ actor, summary, createdAt, job }) =>
            `${createdAt.toISOString()} | ${actor} | ${job.title} | ${summary}`,
        )
        .join('\n'),
    );
  }

  private async listPendingApprovals(state: TurnState) {
    const approvals = await this.dashboard.approvals(state.userId);
    if (approvals.length === 0) return 'Nothing is waiting for the recruiter.';

    return untrusted(
      approvals.map(({ title, job }) => `${title} | ${job}`).join('\n'),
    );
  }

  // Refuses what can't work here, so the recruiter never confirms a card that then fails
  private async proposeCampaignChange(
    args: ProposeCampaignChangeArgs,
    state: TurnState,
  ) {
    const { change } = args;
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: args.campaign_id, job: { userId: state.userId } },
    });

    if (!campaign) {
      return 'That campaign was not found. Call list_campaigns to get its id.';
    }

    const dailyLimit = validLimit(args.daily_limit) ?? null;
    if (args.daily_limit !== null && dailyLimit === null) {
      return `${args.daily_limit} is not a valid daily limit. Ask for another number.`;
    }
    if (!change && !dailyLimit) {
      return 'Say what should change: pause, resume, stop or a new daily limit.';
    }

    const allowed: CampaignStatus[] = change
      ? CHANGE_NEEDS_STATUS[change]
      : CHANGEABLE_STATUSES;

    if (!allowed.includes(campaign.status)) {
      return `${campaign.name} is ${campaign.status.toLowerCase()}, so that can't be done. Tell the recruiter, and don't say it happened.`;
    }

    state.cards.push(
      await this.actions.proposeCampaignChange(
        state.conversation.id,
        campaign,
        change,
        dailyLimit,
      ),
    );
    return 'The confirmation card is showing. Nothing has changed yet, so tell them to confirm it.';
  }

  private async proposeCandidateStatusChange(
    args: ProposeCandidateStatusChangeArgs,
    state: TurnState,
  ) {
    const { jobId } = state.conversation;
    const { status } = args;

    // Outside a job's chat the name is searched across all of the recruiter's jobs
    const matches = await this.prisma.candidate.findMany({
      where: {
        name: { contains: args.candidate_name, mode: 'insensitive' },
        job: { userId: state.userId },
        ...(jobId ? { jobId } : {}),
      },
      include: { job: { select: { title: true } } },
      take: MAX_NAME_MATCHES,
    });

    if (matches.length === 0) {
      return `Nobody called ${args.candidate_name} was found. Say so, and don't guess.`;
    }
    if (matches.length > 1) {
      const names = matches
        .map(({ name, job }) => `${name} (${job.title})`)
        .join(', ');
      return `Several people match: ${names}. Ask which one they mean.`;
    }

    const [candidate] = matches;
    if (!nextStatuses(candidate.status).includes(status)) {
      const allowed = nextStatuses(candidate.status)
        .map(statusLabel)
        .join(', ');
      return `${candidate.name} is ${statusLabel(candidate.status)}, so they can't move to ${statusLabel(status)}. Allowed next: ${allowed || 'none'}.`;
    }

    state.cards.push(
      await this.actions.proposeStatusChange(
        state.conversation.id,
        candidate,
        status,
      ),
    );
    return 'The confirmation card is showing. Nothing changes until they confirm.';
  }

  private async listJobs(state: TurnState) {
    const jobs = await this.prisma.job.findMany({
      where: { userId: state.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, location: true, status: true },
    });

    if (jobs.length === 0) return 'There are no jobs yet.';
    return jobs
      .map(
        (job) =>
          `id=${job.id} | ${job.title} | ${job.location ?? 'location unknown'} | ${job.status}`,
      )
      .join('\n');
  }

  private async getJobStats(jobId: string | null, state: TurnState) {
    const targetId = jobId ?? state.conversation.jobId;
    if (!targetId) return 'There is no job in this chat yet.';

    const job = await this.candidates.assertJobOwned(targetId, state.userId);
    const progress = await this.dashboard.jobProgress(targetId);
    const { funnel, exits } = progress;

    const rate = (value: number | null) =>
      value === null ? 'not available yet' : `${value}%`;

    const campaigns = await this.outreach.jobCampaigns(targetId);
    const outreach = campaigns.map(({ name, status, steps }) => {
      const emails = steps.flatMap((step) => step.emails);
      const sent = emails.filter((email) => email.status === 'SENT').length;
      return `${name} is ${status}, ${sent} of ${emails.length} emails sent.`;
    });

    return [
      `${job.title}. Candidates who reached each stage: ${Object.entries(funnel)
        .map(([stage, count]) => `${stage} ${count}`)
        .join(', ')}.`,
      `Reply rate ${rate(progress.replyRate)}, interested rate ${rate(progress.interestedRate)}.`,
      `Left the process: ${exits.rejected} rejected, ${exits.notInterested} not interested, ${exits.unsubscribed} unsubscribed.`,
      `${progress.upcomingMeetings} upcoming meetings, ${progress.waitingOnRecruiter} items waiting on the recruiter.`,
      ...outreach,
    ].join(' ');
  }
}
