// src/chat/chat.controller.ts
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ActivityActor, PendingActionStatus } from '@prisma/client';
import { interval, map, merge, Observable } from 'rxjs';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { CampaignSetupService } from 'src/campaign-setup/campaign-setup.service';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { SourcingService } from 'src/sourcing/sourcing.service';
import { ActionsService } from './actions.service';
import { AgentService } from './agent.service';
import { CandidatesService } from './candidates.service';
import { ChatService } from './chat.service';
import {
  ActivityQueryDto,
  AnswerQuestionDto,
  CandidateQueryDto,
  ConversationQueryDto,
  DecideCandidateDto,
  SendMessageDto,
  UpdateCandidateStatusDto,
  UpdateJobDraftDto,
  UploadCandidatesDto,
} from './dto/chat.dto';
import { EventsService } from './events.service';
import { PipelineService } from './pipeline.service';

const HEARTBEAT_MS = 20_000;
const MAX_CSV_BYTES = 2 * 1024 * 1024;

@Controller()
@UseGuards(DatabaseAuthGuard)
export class ChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly agent: AgentService,
    private readonly actions: ActionsService,
    private readonly candidates: CandidatesService,
    private readonly sourcing: SourcingService,
    private readonly events: EventsService,
    private readonly campaignSetup: CampaignSetupService,
    private readonly pipeline: PipelineService,
  ) {}

  @Get('chat/conversations')
  listConversations(
    @GetUser('id') userId: string,
    @Query() query: ConversationQueryDto,
  ) {
    return this.chat.listConversations(userId, query);
  }

  @Post('chat/conversations')
  createConversation(@GetUser('id') userId: string) {
    return this.chat.createConversation(userId);
  }

  @Get('chat/conversations/:id')
  getConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.chat.getConversation(id, userId);
  }

  @Post('chat/conversations/:id/messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @GetUser('id') userId: string,
  ) {
    await this.agent.handleMessage(id, userId, dto.content.trim());
    return this.chat.getConversation(id, userId);
  }

  @Post('chat/conversations/:id/stop')
  @HttpCode(HttpStatus.OK)
  async stopMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    await this.chat.assertOwned(id, userId);
    return { stopped: this.agent.stop(id) };
  }

  @Sse('chat/conversations/:id/events')
  async streamEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.chat.assertOwned(id, userId);

    return merge(
      this.events.stream(id).pipe(map((data) => ({ data }))),
      // Keeps the connection open through proxies during quiet moments
      interval(HEARTBEAT_MS).pipe(map(() => ({ data: { type: 'ping' } }))),
    );
  }

  @Post('chat/actions/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmAction(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    await this.actions.confirm(id, userId);
    return { success: true };
  }

  @Post('chat/actions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelAction(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    await this.actions.cancel(id, userId);
    return { success: true };
  }

  // The button goes straight to the setup, with no model deciding what happens
  @Post('chat/conversations/:id/campaign-setup')
  @HttpCode(HttpStatus.OK)
  async startCampaignSetup(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    await this.campaignSetup.start(id, userId);
    return { success: true };
  }

  @Post('chat/questions/:id/answer')
  @HttpCode(HttpStatus.OK)
  async answerQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerQuestionDto,
    @GetUser('id') userId: string,
  ) {
    await this.campaignSetup.answerWithOption(id, dto.optionId, userId);
    return { success: true };
  }

  @Post('chat/questions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    await this.campaignSetup.cancel(id, userId);
    return { success: true };
  }

  @Patch('chat/job-drafts/:id')
  async updateJobDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDraftDto,
    @GetUser('id') userId: string,
  ) {
    const draft = await this.prisma.jobDraft.findFirst({
      where: { id, conversation: { userId } },
      include: { pendingActions: true },
    });

    if (!draft) {
      throw new NotFoundException('Draft not found');
    }

    const editable = draft.pendingActions.some(
      ({ status }) => status === PendingActionStatus.PENDING,
    );
    if (!editable) {
      throw new ConflictException('This draft can no longer be edited');
    }

    return this.prisma.jobDraft.update({ where: { id }, data: dto });
  }

  @Get('jobs/:id/candidates')
  listCandidates(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ) {
    return this.candidates.list(id, userId);
  }

  // A direct click on a row. The click itself is the recruiter's confirmation.
  @Patch('jobs/:id/candidates/:candidateId/decision')
  async decideCandidate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: DecideCandidateDto,
    @GetUser('id') userId: string,
  ) {
    await this.candidates.assertJobOwned(id, userId);
    await this.candidates.decide(
      id,
      [candidateId],
      dto.decision,
      ActivityActor.RECRUITER,
    );
    return { success: true };
  }

  // A direct choice in the table. Using the control is the recruiter's confirmation.
  @Patch('jobs/:id/candidates/:candidateId/status')
  async updateCandidateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: UpdateCandidateStatusDto,
    @GetUser('id') userId: string,
  ) {
    await this.candidates.assertJobOwned(id, userId);
    await this.pipeline.updateStatus(
      id,
      candidateId,
      dto.status,
      ActivityActor.RECRUITER,
    );
    return { success: true };
  }

  @Get('candidates')
  searchCandidates(
    @GetUser('id') userId: string,
    @Query() query: CandidateQueryDto,
  ) {
    return this.candidates.search(userId, query);
  }

  @Get('activity')
  listActivity(
    @GetUser('id') userId: string,
    @Query() query: ActivityQueryDto,
  ) {
    return this.candidates.activity(userId, query);
  }

  // Reads the file so the recruiter can match its columns. Nothing is saved here.
  @Post('jobs/:id/candidates/csv/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES } }),
  )
  async previewCandidates(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @GetUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Choose a CSV file to upload');
    }

    await this.candidates.assertJobOwned(id, userId);
    return this.sourcing.previewCsv(file);
  }

  @Post('jobs/:id/candidates/csv')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES } }),
  )
  async uploadCandidates(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadCandidatesDto,
    @GetUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Choose a CSV file to upload');
    }

    const job = await this.candidates.assertJobOwned(id, userId);
    await this.chat.assertOwned(dto.conversationId, userId);

    const run = await this.sourcing.importCsv(job, dto.conversationId, file, {
      name: dto.nameColumn,
      lastName: dto.lastNameColumn,
      email: dto.emailColumn,
      profileUrl: dto.profileUrlColumn,
      headline: dto.headlineColumn,
      location: dto.locationColumn,
      detailColumns: dto.detailColumns?.split(',').map(Number) ?? [],
    });
    return { success: true, runId: run.id };
  }
}
