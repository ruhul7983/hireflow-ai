// src/chat/candidates.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityActor,
  ActivityType,
  CandidateStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { nextStatuses } from './candidate-status';

// Review only moves candidates between these. Later stages have their own rules.
const REVIEWABLE: CandidateStatus[] = [
  CandidateStatus.SOURCED,
  CandidateStatus.ACCEPTED,
  CandidateStatus.REJECTED,
];

const ACTIVITY_LIMIT = 200;

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

  activity(userId: string) {
    return this.prisma.activityLog.findMany({
      where: { job: { userId } },
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_LIMIT,
      include: { job: { select: { title: true } } },
    });
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
