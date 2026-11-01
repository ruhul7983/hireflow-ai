// src/meetings/meetings.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDate, Length } from 'class-validator';
import { MeetingsService } from './meetings.service';

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
