// src/chat/chat.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsService } from './events.service';

const GREETING =
  "Hi, I'm your recruiting co-worker. Paste a job description or share a link to the posting, and I'll set up the job for you.";

const DEFAULT_TITLE = 'New chat';
const TITLE_LENGTH = 50;

// Everything a card needs. Cards render from these live rows, not from a stored snapshot.
const MESSAGE_INCLUDE = {
  jobDraft: true,
  job: true,
  sourcingRun: true,
  pendingAction: {
    include: {
      candidates: {
        include: {
          candidate: {
            select: { id: true, name: true, headline: true, score: true },
          },
        },
      },
    },
  },
} satisfies Prisma.MessageInclude;

type NewMessage = Omit<Prisma.MessageUncheckedCreateInput, 'conversationId'>;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, jobId: true, updatedAt: true },
    });
  }

  createConversation(userId: string) {
    return this.prisma.conversation.create({
      data: {
        userId,
        messages: {
          create: { role: MessageRole.ASSISTANT, content: GREETING },
        },
      },
      select: { id: true, title: true, jobId: true, updatedAt: true },
    });
  }

  async getConversation(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: MESSAGE_INCLUDE,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async assertOwned(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async appendMessage(conversationId: string, message: NewMessage) {
    const saved = await this.prisma.message.create({
      data: { ...message, conversationId },
    });

    // Touches updatedAt so the most recent chat rises to the top of the list
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    this.events.publish(conversationId, { type: 'changed' });
    return saved;
  }

  async setTitleFromFirstMessage(conversationId: string, content: string) {
    const title = content.replace(/\s+/g, ' ').trim().slice(0, TITLE_LENGTH);
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, title: DEFAULT_TITLE },
      data: { title },
    });
  }

  recentMessages(conversationId: string, limit: number) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
