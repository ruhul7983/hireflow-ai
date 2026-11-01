// src/jobs/jobs.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { containsText, PageQueryDto, paginate } from 'src/common/pagination';
import { DashboardService } from 'src/dashboard/dashboard.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

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

    const summaries = await this.dashboard.summarizeJobs(
      page.items.map(({ id }) => id),
    );

    return {
      ...page,
      items: page.items.map(({ conversations, _count, ...job }) => ({
        ...job,
        conversationId: conversations[0]?.id ?? null,
        campaigns: _count.campaigns,
        ...summaries.get(job.id),
      })),
    };
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
