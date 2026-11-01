// src/chat/candidates.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityActor,
  ActivityType,
  CandidateStatus,
  Prisma,
} from '@prisma/client';
import { containsText, paginate } from 'src/common/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { nextStatuses } from './candidate-status';
import { ActivityQueryDto, CandidateQueryDto } from './dto/chat.dto';

// Review only moves candidates between these. Later stages have their own rules.
const REVIEWABLE: CandidateStatus[] = [
  CandidateStatus.SOURCED,
  CandidateStatus.ACCEPTED,
  CandidateStatus.REJECTED,
];

const LABELS: Partial<Record<CandidateStatus, string>> = {
  [CandidateStatus.ACCEPTED]: 'Accepted',
  [CandidateStatus.REJECTED]: 'Rejected',
};

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async assertJobOwned(jobId: string, userId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  // The one place a pipeline status changes, so every change reaches the activity log
  async changeStatus(
    candidate: {
      id: string;
      jobId: string;
      name: string | null;
      status: CandidateStatus;
    },
    status: CandidateStatus,
    actor: ActivityActor,
  ) {
    if (candidate.status === status) return;

    await this.prisma.$transaction([
      this.prisma.candidate.update({
        where: { id: candidate.id },
        data: { status },
      }),
      this.prisma.activityLog.create({
        data: {
          jobId: candidate.jobId,
          candidateId: candidate.id,
          actor,
          type: ActivityType.CANDIDATE_STATUS_CHANGED,
          fromStatus: candidate.status,
          toStatus: status,
          summary: `${candidate.name ?? 'A candidate'} moved to ${status.toLowerCase().replaceAll('_', ' ')}`,
        },
      }),
    ]);
  }

  async list(jobId: string, userId: string) {
    await this.assertJobOwned(jobId, userId);

    const candidates = await this.prisma.candidate.findMany({
      where: { jobId },
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
    });

    return candidates.map((candidate) => ({
      ...candidate,
      nextStatuses: nextStatuses(candidate.status),
    }));
  }

  // Every job's candidates, a page at a time. The id keeps equal scores in a fixed order.
  async search(userId: string, query: CandidateQueryDto) {
    const { search, status, jobId } = query;
    const text = search ? containsText(search) : undefined;

    const where: Prisma.CandidateWhereInput = {
      job: { userId },
      jobId,
      status,
      ...(text && {
        OR: [
          { name: text },
          { email: text },
          { headline: text },
          { location: text },
        ],
      }),
    };

    const page = await paginate(
      query,
      await this.prisma.candidate.count({ where }),
      (range) =>
        this.prisma.candidate.findMany({
          ...range,
          where,
          orderBy: [
            { score: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
          select: {
            id: true,
            name: true,
            email: true,
            profileUrl: true,
            headline: true,
            location: true,
            score: true,
            scoreReason: true,
            status: true,
            job: { select: { id: true, title: true } },
          },
        }),
    );

    return {
      ...page,
      items: page.items.map((candidate) => ({
        ...candidate,
        nextStatuses: nextStatuses(candidate.status),
      })),
    };
  }

  async activity(userId: string, query: ActivityQueryDto) {
    const { search, actor, jobId } = query;

    const where: Prisma.ActivityLogWhereInput = {
      job: { userId },
      jobId,
      actor,
      ...(search && { summary: containsText(search) }),
    };

    return paginate(
      query,
      await this.prisma.activityLog.count({ where }),
      (range) =>
        this.prisma.activityLog.findMany({
          ...range,
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { job: { select: { title: true } } },
        }),
    );
  }

  // Saves each decision under the job, with its status change in the activity log
  async decide(
    jobId: string,
    candidateIds: string[],
    decision: CandidateStatus,
    actor: ActivityActor,
  ) {
    const candidates = await this.prisma.candidate.findMany({
      where: {
        id: { in: candidateIds },
        jobId,
        status: { in: REVIEWABLE, not: decision },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.candidate.updateMany({
        where: { id: { in: candidates.map(({ id }) => id) } },
        data: { status: decision },
      });

      await tx.activityLog.createMany({
        data: candidates.map((candidate) => ({
          jobId,
          candidateId: candidate.id,
          actor,
          type: ActivityType.CANDIDATE_STATUS_CHANGED,
          fromStatus: candidate.status,
          toStatus: decision,
          summary: `${LABELS[decision]} ${candidate.name ?? 'a candidate'}`,
        })),
      });
    });

    return candidates.length;
  }
}
