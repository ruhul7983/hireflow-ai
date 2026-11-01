// src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import {
  CandidateStatus,
  JobStatus,
  MeetingStatus,
  PendingActionStatus,
  PendingActionType,
  Prisma,
  QuestionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const WEEKS_SHOWN = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_ACTIVITY = 6;
const MAX_APPROVALS = 8;

const STAGES = [
  { key: 'sourced', label: 'Sourced' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'replied', label: 'Replied' },
  { key: 'interested', label: 'Interested' },
  { key: 'meetings', label: 'Meeting booked' },
  { key: 'interviewed', label: 'Interviewed' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'hired', label: 'Hired' },
] as const;

type StageKey = (typeof STAGES)[number]['key'];
type Funnel = Record<StageKey, number>;

// How far each status gets. Rejected and Unsubscribed aren't stages, so someone
// who left keeps the furthest stage they actually reached.
const STAGE_RANK: Partial<Record<CandidateStatus, number>> = {
  ACCEPTED: 1,
  CONTACTED: 2,
  REPLIED: 3,
  NOT_INTERESTED: 3,
  INTERESTED: 4,
  MEETING_BOOKED: 5,
  INTERVIEWED: 6,
  SHORTLISTED: 7,
  HIRED: 8,
};

const WEEKLY_STATUSES = {
  contacted: CandidateStatus.CONTACTED,
  replied: CandidateStatus.REPLIED,
  interested: CandidateStatus.INTERESTED,
  meetings: CandidateStatus.MEETING_BOOKED,
  hired: CandidateStatus.HIRED,
};

type TrackedCandidate = { id: string; status: CandidateStatus };
type History = Map<string, CandidateStatus[]>;

function percentage(part: number, whole: number) {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

function furthestRank({ id, status }: TrackedCandidate, history: History) {
  // A hire can be undone, so Hired only counts while it's their current status
  const reached = (history.get(id) ?? []).filter(
    (past) => past !== CandidateStatus.HIRED,
  );
  return Math.max(0, ...[status, ...reached].map((s) => STAGE_RANK[s] ?? 0));
}

function buildFunnel(candidates: TrackedCandidate[], history: History) {
  const ranks = candidates.map((candidate) => furthestRank(candidate, history));

  return Object.fromEntries(
    STAGES.map(({ key }, rank) => [
      key,
      ranks.filter((reached) => reached >= rank).length,
    ]),
  ) as Funnel;
}

function countExits(candidates: TrackedCandidate[]) {
  const count = (status: CandidateStatus) =>
    candidates.filter((candidate) => candidate.status === status).length;

  return {
    rejected: count(CandidateStatus.REJECTED),
    notInterested: count(CandidateStatus.NOT_INTERESTED),
    unsubscribed: count(CandidateStatus.UNSUBSCRIBED),
  };
}

function jobPhase(funnel: Funnel) {
  if (funnel.hired > 0) return 'Hired';
  if (funnel.interviewed > 0) return 'Interviewing';
  if (funnel.contacted > 0) return 'Outreach';
  return 'Sourcing';
}

function approvalKind(type: PendingActionType) {
  switch (type) {
    case PendingActionType.SEND_REPLY:
    case PendingActionType.APPROVE_REPLY:
      return 'reply';
    case PendingActionType.CREATE_CAMPAIGN:
    case PendingActionType.SEND_CAMPAIGN:
    case PendingActionType.CHANGE_CAMPAIGN:
      return 'campaign';
    case PendingActionType.CREATE_JOB:
    case PendingActionType.UPDATE_JOB:
    case PendingActionType.CHANGE_AUTO_REPLY:
      return 'job';
    default:
      return 'candidates';
  }
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadHistory(scope: Prisma.ActivityLogWhereInput) {
    const rows = await this.prisma.activityLog.findMany({
      where: {
        ...scope,
        candidateId: { not: null },
        toStatus: { not: null },
      },
      select: { candidateId: true, toStatus: true, createdAt: true },
    });

    const history: History = new Map();
    for (const { candidateId, toStatus } of rows) {
      if (!candidateId || !toStatus) continue;
      history.set(candidateId, [...(history.get(candidateId) ?? []), toStatus]);
    }

    return { rows, history };
  }

  private loadJobs(userId: string) {
    return this.prisma.job.findMany({
      where: { userId, status: JobStatus.OPEN },
      orderBy: { createdAt: 'desc' },
      include: {
        candidates: { select: { id: true, status: true, createdAt: true } },
        conversations: {
          select: { id: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  private weeklyCounts(
    history: { toStatus: CandidateStatus | null; createdAt: Date }[],
    candidates: { createdAt: Date }[],
  ) {
    const now = Date.now();
    const weekStarts = Array.from(
      { length: WEEKS_SHOWN },
      (_, index) => now - (WEEKS_SHOWN - index) * WEEK_MS,
    );

    const bucket = (dates: Date[]) =>
      weekStarts.map(
        (start) =>
          dates.filter(
            (date) =>
              date.getTime() >= start && date.getTime() < start + WEEK_MS,
          ).length,
      );

    const datesFor = (status: CandidateStatus) =>
      history
        .filter(({ toStatus }) => toStatus === status)
        .map(({ createdAt }) => createdAt);

    const sourced = bucket(candidates.map(({ createdAt }) => createdAt));
    const series = Object.fromEntries(
      Object.entries(WEEKLY_STATUSES).map(([key, status]) => [
        key,
        bucket(datesFor(status)),
      ]),
    ) as Record<keyof typeof WEEKLY_STATUSES, number[]>;

    return weekStarts.map((start, index) => ({
      weekStart: new Date(start).toISOString(),
      sourced: sourced[index],
      contacted: series.contacted[index],
      replied: series.replied[index],
      interested: series.interested[index],
      meetings: series.meetings[index],
      hired: series.hired[index],
    }));
  }

  private async replyOutcomes(userId: string) {
    const rows = await this.prisma.candidateReply.groupBy({
      by: ['classification'],
      where: {
        candidate: { job: { userId } },
        classification: { not: null },
      },
      _count: true,
    });

    return rows.map(({ classification, _count }) => ({
      classification,
      count: _count,
    }));
  }

  async approvals(userId: string) {
    const [actions, questions] = await Promise.all([
      this.prisma.pendingAction.findMany({
        where: {
          status: PendingActionStatus.PENDING,
          conversation: { userId },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_APPROVALS,
        include: {
          job: { select: { title: true } },
          jobDraft: { select: { title: true } },
          campaign: { select: { name: true } },
          reply: { select: { candidate: { select: { name: true } } } },
          _count: { select: { candidates: true } },
        },
      }),
      this.prisma.agentQuestion.findMany({
        where: {
          status: QuestionStatus.PENDING,
          conversation: { userId },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_APPROVALS,
        include: {
          conversation: { select: { job: { select: { title: true } } } },
        },
      }),
    ]);

    const titleFor = (action: (typeof actions)[number]) => {
      switch (action.type) {
        case PendingActionType.CREATE_JOB:
          return `Confirm ${action.jobDraft?.title ?? 'a new job'}`;
        case PendingActionType.START_SOURCING:
          return 'Start the candidate search';
        case PendingActionType.CREATE_CAMPAIGN:
          return `Confirm the plan for ${action.campaignName}`;
        case PendingActionType.SEND_CAMPAIGN:
          return `Approve drafts for ${action.campaign?.name ?? 'a campaign'}`;
        case PendingActionType.CHANGE_CAMPAIGN:
          return `Confirm a change to ${action.campaignName}`;
        case PendingActionType.UPDATE_JOB:
          return `Confirm changes to ${action.job?.title ?? 'a job'}`;
        case PendingActionType.APPROVE_REPLY:
        case PendingActionType.RETRY_SCORING:
        case PendingActionType.CHANGE_AUTO_REPLY:
          return action.title ?? 'Confirm a change';
        case PendingActionType.SEND_REPLY:
          return `Reply to ${action.reply?.candidate.name ?? 'a candidate'}`;
        default:
          return `Confirm a change to ${action._count.candidates} candidates`;
      }
    };

    return [
      ...actions.map((action) => ({
        id: action.id,
        kind: approvalKind(action.type),
        title: titleFor(action),
        job: action.job?.title ?? 'New job',
        conversationId: action.conversationId,
      })),
      ...questions.map((question) => ({
        id: question.id,
        kind: 'campaign',
        title: 'Finish setting up outreach',
        job: question.conversation.job?.title ?? 'Outreach',
        conversationId: question.conversationId,
      })),
    ].slice(0, MAX_APPROVALS);
  }

  private recentActivity(userId: string) {
    return this.prisma.activityLog.findMany({
      where: { job: { userId } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ACTIVITY,
      select: {
        id: true,
        actor: true,
        summary: true,
        createdAt: true,
        job: { select: { title: true } },
      },
    });
  }

  private rates(funnel: Funnel) {
    return {
      replyRate: percentage(funnel.replied, funnel.contacted),
      interestedRate: percentage(funnel.interested, funnel.replied),
    };
  }

  private jobSummary(candidates: TrackedCandidate[], history: History) {
    const funnel = buildFunnel(candidates, history);

    return { phase: jobPhase(funnel), funnel, ...this.rates(funnel) };
  }

  // Scoped to the jobs asked for, so listing a page doesn't read all the history
  async summarizeJobs(jobIds: string[]) {
    const [candidates, { history }] = await Promise.all([
      this.prisma.candidate.findMany({
        where: { jobId: { in: jobIds } },
        select: { id: true, jobId: true, status: true },
      }),
      this.loadHistory({ jobId: { in: jobIds } }),
    ]);

    return new Map(
      jobIds.map((id) => [
        id,
        this.jobSummary(
          candidates.filter(({ jobId }) => jobId === id),
          history,
        ),
      ]),
    );
  }

  async overview(userId: string) {
    const [jobs, { rows, history }, replyOutcomes, approvals, activity] =
      await Promise.all([
        this.loadJobs(userId),
        this.loadHistory({ job: { userId } }),
        this.replyOutcomes(userId),
        this.approvals(userId),
        this.recentActivity(userId),
      ]);

    const allCandidates = jobs.flatMap(({ candidates }) => candidates);
    const funnel = buildFunnel(allCandidates, history);

    return {
      summary: {
        openJobs: jobs.length,
        ...this.rates(funnel),
        sourced: funnel.sourced,
        meetings: funnel.meetings,
        hires: funnel.hired,
      },
      stages: STAGES.map(({ key, label }) => ({
        key,
        label,
        count: funnel[key],
      })),
      exits: countExits(allCandidates),
      weeks: this.weeklyCounts(rows, allCandidates),
      replyOutcomes,
      approvals,
      activity,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        location: job.location,
        remotePolicy: job.remotePolicy,
        conversationId: job.conversations[0]?.id ?? null,
        ...this.jobSummary(job.candidates, history),
      })),
    };
  }

  // The same numbers as the dashboard, so the AI and the page can't disagree
  async jobProgress(jobId: string) {
    const [candidates, { history }, upcomingMeetings, waiting] =
      await Promise.all([
        this.prisma.candidate.findMany({
          where: { jobId },
          select: { id: true, status: true },
        }),
        this.loadHistory({ jobId }),
        this.prisma.meeting.count({
          where: {
            status: MeetingStatus.BOOKED,
            startsAt: { gte: new Date() },
            candidate: { jobId },
          },
        }),
        this.prisma.pendingAction.count({
          where: { jobId, status: PendingActionStatus.PENDING },
        }),
      ]);

    const funnel = buildFunnel(candidates, history);

    return {
      funnel,
      ...this.rates(funnel),
      exits: countExits(candidates),
      upcomingMeetings,
      waitingOnRecruiter: waiting,
    };
  }
}
