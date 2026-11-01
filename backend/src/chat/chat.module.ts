// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CampaignAnswerReader } from 'src/campaign-setup/campaign-setup.answers';
import { CampaignSetupService } from 'src/campaign-setup/campaign-setup.service';
import { PrismaCheckpointSaver } from 'src/campaign-setup/prisma-checkpoint.saver';
import { DashboardController } from 'src/dashboard/dashboard.controller';
import { DashboardService } from 'src/dashboard/dashboard.service';
import { JobsController } from 'src/jobs/jobs.controller';
import { JobsService } from 'src/jobs/jobs.service';
import { MeetingsController } from 'src/meetings/meetings.controller';
import { MeetingsService } from 'src/meetings/meetings.service';
import { DraftingService } from 'src/outreach/drafting.service';
import { MailerService } from 'src/outreach/mailer.service';
import { OutreachController } from 'src/outreach/outreach.controller';
import { OutreachService } from 'src/outreach/outreach.service';
import { InboxService } from 'src/replies/inbox.service';
import { RepliesController } from 'src/replies/replies.controller';
import { RepliesService } from 'src/replies/replies.service';
import { ReplyReaderService } from 'src/replies/reply-reader.service';
import { ScoringService } from 'src/sourcing/scoring.service';
import { SerperService } from 'src/sourcing/serper.service';
import { SourcingService } from 'src/sourcing/sourcing.service';
import { ActionsService } from './actions.service';
import { AgentToolsService } from './agent-tools.service';
import { AgentService } from './agent.service';
import { CandidatesService } from './candidates.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { EventsService } from './events.service';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [AuthModule],
  controllers: [
    ChatController,
    DashboardController,
    JobsController,
    MeetingsController,
    OutreachController,
    RepliesController,
  ],
  providers: [
    ActionsService,
    AgentService,
    AgentToolsService,
    CampaignAnswerReader,
    CampaignSetupService,
    CandidatesService,
    ChatService,
    DashboardService,
    DraftingService,
    EventsService,
    InboxService,
    JobsService,
    MailerService,
    MeetingsService,
    OutreachService,
    PipelineService,
    PrismaCheckpointSaver,
    RepliesService,
    ReplyReaderService,
    ScoringService,
    SerperService,
    SourcingService,
  ],
})
export class ChatModule {}
