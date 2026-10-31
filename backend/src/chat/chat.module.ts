// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
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
  controllers: [ChatController],
  providers: [
    ActionsService,
    AgentService,
    CandidatesService,
    ChatService,
    EventsService,
    ScoringService,
    SerperService,
    SourcingService,
  ],
})
export class ChatModule {}
