// src/jobs/jobs.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityActor, ActivityType, Prisma } from '@prisma/client';
import { containsText, PageQueryDto, paginate } from 'src/common/pagination';
import { DashboardService } from 'src/dashboard/dashboard.service';
import { LlmService } from 'src/llm/llm.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly llm: LlmService,
  ) {}

  private async usageByJob(jobIds: string[]) {
    const rows = await this.prisma.llmUsage.groupBy({
      by: ['jobId'],
      where: { jobId: { in: jobIds } },
      _sum: { inputTokens: true, outputTokens: true },
    });

    return new Map(
      rows.map(({ jobId, _sum }) => {
        const input = _sum.inputTokens ?? 0;
        const output = _sum.outputTokens ?? 0;

        return [
          jobId,
          { tokens: input + output, costUsd: this.llm.costOf(input, output) },
        ];
      }),
    );
  }

  async list(userId: string, query: PageQueryDto) {
    const { search } = query;
    const text = search ? containsText(search) : undefined;

    const where: Prisma.JobWhereInput = {
      userId,
      ...(text && {
        OR: [{ title: text }, { location: text }, { seniority: text }],
      }),
    };

    const page = await paginate(
      query,
      await this.prisma.job.count({ where }),
      (range) =>
        this.prisma.job.findMany({
          ...range,
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            title: true,
            seniority: true,
            location: true,
            remotePolicy: true,
            autoReply: true,
            createdAt: true,
            conversations: {
              select: { id: true },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
            _count: { select: { campaigns: true } },
          },
        }),
    );

    const jobIds = page.items.map(({ id }) => id);
    const [summaries, usage] = await Promise.all([
      this.dashboard.summarizeJobs(jobIds),
      this.usageByJob(jobIds),
    ]);

    return {
      ...page,
      items: page.items.map(({ conversations, _count, ...job }) => ({
        ...job,
        conversationId: conversations[0]?.id ?? null,
        campaigns: _count.campaigns,
        ...summaries.get(job.id),
        usage: usage.get(job.id) ?? { tokens: 0, costUsd: 0 },
      })),
    };
  }

  async setAutoReply(jobId: string, userId: string, enabled: boolean) {
    const { count } = await this.prisma.job.updateMany({
      where: { id: jobId, userId },
      data: { autoReply: enabled },
    });

    if (count === 0) {
      throw new NotFoundException('Job not found');
    }

    await this.prisma.activityLog.create({
      data: {
        jobId,
        actor: ActivityActor.RECRUITER,
        type: ActivityType.AUTO_REPLY_CHANGED,
        summary: `Turned auto-reply ${enabled ? 'on' : 'off'}`,
      },
    });
    return { success: true };
  }

  // Only what the job filters on other pages need
  options(userId: string) {
    return this.prisma.job.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: { id: true, title: true },
    });
  }
}
