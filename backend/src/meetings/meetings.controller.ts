// src/meetings/meetings.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MeetingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsOptional, Length } from 'class-validator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { JobPageQueryDto } from 'src/common/pagination';
import { MEETING_WINDOWS, MeetingsService } from './meetings.service';
import type { MeetingWindow } from './meetings.service';

const TOKEN_LENGTH = 48;

class TokenParam {
  @Length(TOKEN_LENGTH, TOKEN_LENGTH)
  token: string;
}

class BookMeetingDto {
  @Type(() => Date)
  @IsDate({ message: 'Please pick a valid time' })
  startsAt: Date;
}

export class MeetingQueryDto extends JobPageQueryDto {
  @IsOptional()
  @IsEnum(MeetingStatus, { message: 'That status is not valid' })
  status?: MeetingStatus;

  @IsOptional()
  @IsIn(MEETING_WINDOWS, { message: 'That time filter is not valid' })
  when?: MeetingWindow;
}

@Controller('meetings')
@UseGuards(DatabaseAuthGuard)
export class MeetingsListController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@GetUser('id') userId: string, @Query() query: MeetingQueryDto) {
    return this.meetings.list(userId, query);
  }
}

// No login guard: candidates aren't users, so the unguessable token is the access
@Controller('meetings/public')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get(':token')
  view(@Param() { token }: TokenParam) {
    return this.meetings.publicView(token);
  }

  @Post(':token/book')
  @HttpCode(HttpStatus.OK)
  book(@Param() { token }: TokenParam, @Body() { startsAt }: BookMeetingDto) {
    return this.meetings.book(token, startsAt);
  }
}
