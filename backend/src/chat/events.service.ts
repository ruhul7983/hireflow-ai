// src/chat/events.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SourcingRun } from '@prisma/client';
import { Redis } from 'ioredis';
import { filter, map, Observable, Subject } from 'rxjs';
import { queueOptions } from 'src/queue/redis-options';

export type ChatEvent =
  | { type: 'changed' } // Something new was saved, so the client reloads the conversation
  | { type: 'run'; run: SourcingRun }; // Live counters for a progress card

type Envelope = { conversationId: string; event: ChatEvent };

// Goes through Redis because the worker that does the job may not be the process
// holding the browser's stream.
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private readonly events$ = new Subject<Envelope>();
  private readonly channel: string;
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(configService: ConfigService) {
    const { connection, prefix } = queueOptions(configService);

    this.channel = `${prefix}:chat-events`;
    this.publisher = new Redis(connection);
    this.subscriber = new Redis(connection);
  }

  async onModuleInit() {
    for (const client of [this.publisher, this.subscriber]) {
      // Without a listener, a lost Redis connection would crash the process
      client.on('error', (error: Error) => this.logger.error(error.message));
    }

    this.subscriber.on('message', (_channel: string, message: string) => {
      this.events$.next(JSON.parse(message) as Envelope);
    });
    await this.subscriber.subscribe(this.channel);
  }

  async onModuleDestroy() {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }

  publish(conversationId: string, event: ChatEvent) {
    // Live updates are a convenience, so a failure here must not fail the job
    this.publisher
      .publish(this.channel, JSON.stringify({ conversationId, event }))
      .catch((error: Error) => this.logger.error(error.message));
  }

  stream(conversationId: string): Observable<ChatEvent> {
    return this.events$.pipe(
      filter((entry) => entry.conversationId === conversationId),
      map((entry) => entry.event),
    );
  }
}
