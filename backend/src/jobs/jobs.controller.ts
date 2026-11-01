// src/jobs/jobs.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { PageQueryDto } from 'src/common/pagination';
import { JobsService } from './jobs.service';

class UpdateAutoReplyDto {
  @IsBoolean()
  enabled: boolean;
}

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

  // A direct choice in the table. Using the control is the recruiter's confirmation.
  @Patch(':id/auto-reply')
  setAutoReply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutoReplyDto,
    @GetUser('id') userId: string,
  ) {
    return this.jobs.setAutoReply(id, userId, dto.enabled);
  }
}
