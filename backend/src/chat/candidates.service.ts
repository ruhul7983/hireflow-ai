// src/chat/candidates.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityActor,
  ActivityType,
  CandidateStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

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

  async list(jobId: string, userId: string) {
    await this.assertJobOwned(jobId, userId);

    return this.prisma.candidate.findMany({
      where: { jobId },
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
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
