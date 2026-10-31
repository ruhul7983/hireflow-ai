// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CampaignAnswerReader } from 'src/campaign-setup/campaign-setup.answers';
import { CampaignSetupService } from 'src/campaign-setup/campaign-setup.service';
import { PrismaCheckpointSaver } from 'src/campaign-setup/prisma-checkpoint.saver';
import { DraftingService } from 'src/outreach/drafting.service';
import { MailerService } from 'src/outreach/mailer.service';
import { OutreachController } from 'src/outreach/outreach.controller';
import { OutreachService } from 'src/outreach/outreach.service';
import { ScoringService } from 'src/sourcing/scoring.service';
import { SerperService } from 'src/sourcing/serper.service';
import { SourcingService } from 'src/sourcing/sourcing.service';
import { ActionsService } from './actions.service';
import { AgentService } from './agent.service';
import { CandidatesService } from './candidates.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule],
  controllers: [ChatController, OutreachController],
  providers: [
    ActionsService,
    AgentService,
    CampaignAnswerReader,
    CampaignSetupService,
    CandidatesService,
    ChatService,
    DraftingService,
    EventsService,
    MailerService,
    OutreachService,
    PrismaCheckpointSaver,
    ScoringService,
    SerperService,
    SourcingService,
  ],
})
export class ChatModule {}
