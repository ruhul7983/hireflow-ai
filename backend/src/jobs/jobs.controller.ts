// src/jobs/jobs.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { PageQueryDto } from 'src/common/pagination';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(DatabaseAuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@GetUser('id') userId: string, @Query() query: PageQueryDto) {
    return this.jobs.list(userId, query);
  }

  @Get('options')
  options(@GetUser('id') userId: string) {
    return this.jobs.options(userId);
  }
}
