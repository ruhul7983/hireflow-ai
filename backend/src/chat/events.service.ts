// src/chat/events.service.ts
import { Injectable } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';
import { SourcingRun } from '@prisma/client';

export type ChatEvent =
  | { type: 'changed' } // Something new was saved, so the client reloads the conversation
  | { type: 'run'; run: SourcingRun }; // Live counters for a progress card

// Workers run in this same process, so an in-memory bus reaches every open stream.
// Running workers separately would need Redis pub/sub here instead.
@Injectable()
export class EventsService {
  private readonly events$ = new Subject<{
    conversationId: string;
    event: ChatEvent;
  }>();

  publish(conversationId: string, event: ChatEvent) {
    this.events$.next({ conversationId, event });
  }

  stream(conversationId: string): Observable<ChatEvent> {
    return this.events$.pipe(
      filter((entry) => entry.conversationId === conversationId),
      map((entry) => entry.event),
    );
  }
}
