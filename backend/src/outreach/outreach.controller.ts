// src/outreach/outreach.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { OutreachService } from './outreach.service';

class UpdateEmailDraftDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'The subject cannot be empty' })
  @MaxLength(200, { message: 'That subject is too long' })
  subject?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'The email cannot be empty' })
  @MaxLength(5000, { message: 'That email is too long' })
  body?: string;
}

@Controller('campaigns')
@UseGuards(DatabaseAuthGuard)
export class OutreachController {
  constructor(private readonly outreach: OutreachService) {}

  @Get(':id')
  async getCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    const campaign = await this.outreach.getCampaign(id, userId);
    return { ...campaign, emails: await this.outreach.listEmails(id) };
  }

  @Patch(':id/emails/:emailId')
  updateEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('emailId', ParseUUIDPipe) emailId: string,
    @Body() dto: UpdateEmailDraftDto,
    @GetUser('id') userId: string,
  ) {
    return this.outreach.updateDraft(id, emailId, userId, dto);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.outreach.setPaused(id, userId, true);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.outreach.setPaused(id, userId, false);
  }
}
