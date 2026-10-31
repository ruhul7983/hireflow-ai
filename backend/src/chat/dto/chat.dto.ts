// src/chat/dto/chat.dto.ts
import { CandidateStatus, RemotePolicy } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const MAX_MESSAGE_LENGTH = 20_000;
const MAX_SKILLS = 30;

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MaxLength(MAX_MESSAGE_LENGTH, { message: 'That message is too long' })
  content: string;
}

export class UpdateJobDraftDto {
  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  seniority?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsString()
  salary?: string | null;

  @IsOptional()
  @IsEnum(RemotePolicy)
  remotePolicy?: RemotePolicy | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SKILLS)
  @IsString({ each: true })
  mustHaveSkills?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SKILLS)
  @IsString({ each: true })
  niceToHaveSkills?: string[];
}

export class DecideCandidateDto {
  @IsIn([CandidateStatus.ACCEPTED, CandidateStatus.REJECTED], {
    message: 'Decision must be accepted or rejected',
  })
  decision: CandidateStatus;
}

export class AnswerQuestionDto {
  @IsUUID()
  optionId: string;
}

export class UploadCandidatesDto {
  @IsUUID()
  conversationId: string;
}
