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
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ActivityActor, PendingActionStatus } from '@prisma/client';
import { interval, map, merge, Observable } from 'rxjs';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { DatabaseAuthGuard } from 'src/auth/guards/database-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { SourcingService } from 'src/sourcing/sourcing.service';
import { ActionsService } from './actions.service';
import { AgentService } from './agent.service';
import { CandidatesService } from './candidates.service';
import { ChatService } from './chat.service';
import {
  DecideCandidateDto,
  SendMessageDto,
  UpdateJobDraftDto,
  UploadCandidatesDto,
} from './dto/chat.dto';
import { EventsService } from './events.service';

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
  ) {}

  @Get('chat/conversations')
  listConversations(@GetUser('id') userId: string) {
    return this.chat.listConversations(userId);
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

    const run = await this.sourcing.importCsv(job, dto.conversationId, file);
    return { success: true, runId: run.id };
  }
}
