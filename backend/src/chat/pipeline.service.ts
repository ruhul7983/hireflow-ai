// src/chat/pipeline.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityActor, CandidateStatus } from '@prisma/client';
import { MeetingsService } from 'src/meetings/meetings.service';
import { OutreachService } from 'src/outreach/outreach.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { nextStatuses, statusLabel } from './candidate-status';
import { CandidatesService } from './candidates.service';

// Moving past these means there's nothing left to meet about
const ENDS_THE_PROCESS: CandidateStatus[] = [
  CandidateStatus.REJECTED,
  CandidateStatus.NOT_INTERESTED,
  CandidateStatus.UNSUBSCRIBED,
];

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly outreach: OutreachService,
    private readonly meetings: MeetingsService,
  ) {}

  // The single path for a recruiter's status change, from the UI or a confirmed chat card
  async updateStatus(
    jobId: string,
    candidateId: string,
    status: CandidateStatus,
    actor: ActivityActor,
  ) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, jobId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }
    if (!nextStatuses(candidate.status).includes(status)) {
      throw new BadRequestException(
        `A candidate who is ${statusLabel(candidate.status).toLowerCase()} can't move to ${statusLabel(status).toLowerCase()}`,
      );
    }

    await this.candidates.changeStatus(candidate, status, actor);

    // Accepted is the only move that still leads to outreach
    if (status !== CandidateStatus.ACCEPTED) {
      await this.outreach.stopFollowUps(candidateId);
    }
    if (ENDS_THE_PROCESS.includes(status)) {
      await this.meetings.cancelOpen(candidateId);
    }
  }
}
