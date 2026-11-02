// src/replies/replies.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsTimeZone,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { RepliesService } from './replies.service';

const MAX_REPLY_LENGTH = 5000;

class SimulateReplyDto {
  @IsUUID()
  candidateId: string;

  @IsString()
  @IsNotEmpty({ message: 'The reply cannot be empty' })
  @MaxLength(MAX_REPLY_LENGTH, { message: 'That reply is too long' })
  body: string;
}

class UpdateReplyDraftDto {
  @IsString()
  @IsNotEmpty({ message: 'The reply cannot be empty' })
  @MaxLength(MAX_REPLY_LENGTH, { message: 'That reply is too long' })
  draftBody: string;
}

class SetMeetingTimeDto {
  @ValidateIf((dto: SetMeetingTimeDto) => dto.startsAt !== null)
  @IsISO8601({}, { message: 'That date and time is not valid' })
  startsAt: string | null;

  @IsTimeZone({ message: 'That timezone is not valid' })
  timeZone: string;
}

@Controller()
@UseGuards(DatabaseAuthGuard)
export class RepliesController {
  constructor(private readonly replies: RepliesService) {}

  // Stands in for a real inbox, and is the same path a mail webhook would use
  @Post('simulate-reply')
  @HttpCode(HttpStatus.OK)
  async simulateReply(
    @Body() dto: SimulateReplyDto,
    @GetUser('id') userId: string,
  ) {
    await this.replies.receive(dto.candidateId, userId, dto.body.trim());
    return { success: true };
  }

  @Patch('replies/:id/meeting-time')
  setMeetingTime(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMeetingTimeDto,
    @GetUser('id') userId: string,
  ) {
    return this.replies.setMeetingTime(
      id,
      userId,
      dto.startsAt ? new Date(dto.startsAt) : null,
      dto.timeZone,
    );
  }

  @Patch('replies/:id/draft')
  updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReplyDraftDto,
    @GetUser('id') userId: string,
  ) {
    return this.replies.updateDraft(id, userId, dto.draftBody);
  }
}
