// src/replies/inbox.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { PrismaService } from 'src/prisma/prisma.service';

const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_REPLY_LENGTH = 5000;

// How mail apps introduce the quoted email, including when Gmail wraps it over two lines
const QUOTE_HEADER =
  /^(On\s[\s\S]{0,200}?wrote:|-{2,}\s*Original Message\s*-{2,}|From:\s.+)\s*$/im;

export type InboundReply = {
  candidateId: string;
  userId: string;
  body: string;
  messageId: string;
};

export function stripQuotedText(text: string) {
  const [latest] = text.split(QUOTE_HEADER);

  return latest
    .split('\n')
    .filter((line) => !line.startsWith('>'))
    .join('\n')
    .trim()
    .slice(0, MAX_REPLY_LENGTH);
}

// Connects to the same account that sends. Only answers to our own emails are opened,
// so the rest of the mailbox is never read, and nothing is marked as read.
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);
  private readonly host: string | undefined;
  private readonly port: number;
  private readonly user: string | undefined;
  private readonly pass: string | undefined;
  private lastError: string | null = null;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.host = configService.get<string>('IMAP_HOST');
    this.port = Number(configService.get('IMAP_PORT') || 993);
    this.user = configService.get<string>('SMTP_USER');
    this.pass = configService.get<string>('SMTP_PASS')?.replace(/\s/g, '');
  }

  get enabled() {
    return Boolean(this.host && this.user && this.pass);
  }

  // Maps each email we sent to who received it, from the ids a reply refers back to
  private async findThreads(parentIds: string[]) {
    const [emails, replies] = await Promise.all([
      this.prisma.outboundEmail.findMany({
        where: { messageId: { in: parentIds } },
        select: {
          messageId: true,
          candidate: {
            select: {
              id: true,
              email: true,
              job: { select: { userId: true } },
            },
          },
        },
      }),
      this.prisma.candidateReply.findMany({
        where: { messageId: { in: parentIds } },
        select: {
          messageId: true,
          candidate: {
            select: {
              id: true,
              email: true,
              job: { select: { userId: true } },
            },
          },
        },
      }),
    ]);

    return new Map(
      [...emails, ...replies].map(({ messageId, candidate }) => [
        messageId,
        candidate,
      ]),
    );
  }

  async newReplies(): Promise<InboundReply[]> {
    if (!this.enabled) return [];

    const client = new ImapFlow({
      host: this.host ?? '',
      port: this.port,
      secure: true,
      auth: { user: this.user ?? '', pass: this.pass },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const replies = await this.readReplies(client);
        this.lastError = null;
        return replies;
      } finally {
        lock.release();
      }
    } catch (error) {
      // The check runs every minute, so a wrong password is only worth one log line
      const { message } = error as Error;
      if (message !== this.lastError) this.logger.error(`Inbox check failed: ${message}`);
      this.lastError = message;
      return [];
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private async readReplies(client: ImapFlow) {
    const since = new Date(Date.now() - LOOKBACK_MS);
    const uids = (await client.search({ since }, { uid: true })) || [];
    if (uids.length === 0) return [];

    const headers: {
      uid: number;
      from: string;
      parentId: string;
      messageId: string;
    }[] = [];

    for await (const message of client.fetch(
      uids,
      { uid: true, envelope: true },
      { uid: true },
    )) {
      const { inReplyTo, messageId, from } = message.envelope ?? {};
      const address = from?.[0]?.address?.toLowerCase();

      // Mail to yourself also lands here, and it's not a candidate answering
      if (inReplyTo && messageId && address && address !== this.user?.toLowerCase()) {
        headers.push({
          uid: message.uid,
          from: address,
          parentId: inReplyTo,
          messageId,
        });
      }
    }

    const threads = await this.findThreads(headers.map((h) => h.parentId));
    const fresh = headers.filter(({ parentId, from }) => {
      return threads.get(parentId)?.email?.toLowerCase() === from;
    });

    const handled = await this.prisma.candidateReply.findMany({
      where: { inboundMessageId: { in: fresh.map((h) => h.messageId) } },
      select: { inboundMessageId: true },
    });
    const seen = new Set(handled.map((reply) => reply.inboundMessageId));

    const replies: InboundReply[] = [];
    for (const { uid, parentId, messageId } of fresh) {
      if (seen.has(messageId)) continue;

      const message = await client.fetchOne(
        String(uid),
        { source: true },
        { uid: true },
      );
      if (!message || !message.source) continue;

      const { text } = await simpleParser(message.source);
      const body = stripQuotedText(text ?? '');
      const candidate = threads.get(parentId);

      if (body && candidate) {
        replies.push({
          candidateId: candidate.id,
          userId: candidate.job.userId,
          body,
          messageId,
        });
      }
    }
    return replies;
  }
}
