// src/chat/dto/chat.dto.ts
import { ActivityActor, CandidateStatus, RemotePolicy } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { JobPageQueryDto } from 'src/common/pagination';

const MAX_MESSAGE_LENGTH = 20_000;
const MAX_SKILLS = 30;

export class ConversationQueryDto {
  @IsOptional()
  @Matches(/^[\d\-:.TZ]+_[\da-f-]+$/, { message: 'That cursor is not valid' })
  cursor?: string;

  @IsOptional()
  @IsIn(['all', 'jobs'], { message: 'That list is not valid' })
  scope?: 'all' | 'jobs';
}

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

export class UpdateCandidateStatusDto {
  @IsEnum(CandidateStatus, { message: 'That status is not valid' })
  status: CandidateStatus;
}

export class CandidateQueryDto extends JobPageQueryDto {
  @IsOptional()
  @IsEnum(CandidateStatus, { message: 'That status is not valid' })
  status?: CandidateStatus;
}

export class ActivityQueryDto extends JobPageQueryDto {
  @IsOptional()
  @IsEnum(ActivityActor, { message: 'That actor is not valid' })
  actor?: ActivityActor;
}

export class AnswerQuestionDto {
  @IsUUID()
  optionId: string;
}

export class UploadCandidatesDto {
  @IsUUID()
  conversationId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  nameColumn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lastNameColumn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  emailColumn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  profileUrlColumn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  headlineColumn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  locationColumn?: number;

  // Comma separated positions, because multipart fields are plain strings
  @IsOptional()
  @Matches(/^\d+(,\d+)*$/, { message: 'Invalid detail columns' })
  detailColumns?: string;
}
