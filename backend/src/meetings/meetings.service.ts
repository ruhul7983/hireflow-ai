// src/meetings/meetings.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityActor,
  ActivityType,
  CandidateStatus,
  CardType,
  MeetingStatus,
  MessageRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { CandidatesService } from 'src/chat/candidates.service';
import { ChatService } from 'src/chat/chat.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { upcomingSlots } from './booking-slots';

const TOKEN_BYTES = 24;

// A booking must not pull someone backwards from a later stage
const BOOKABLE_FROM: CandidateStatus[] = [
  CandidateStatus.CONTACTED,
  CandidateStatus.REPLIED,
  CandidateStatus.INTERESTED,
  CandidateStatus.NOT_INTERESTED,
];

const OPEN_STATUSES: MeetingStatus[] = [
  MeetingStatus.DRAFTED,
  MeetingStatus.LINK_SENT,
];

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly candidates: CandidatesService,
    private readonly configService: ConfigService,
  ) {}

  private bookingUrl(token: string) {
    const base =
      this.configService.get<string>('APP_URL') ??
      this.configService.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000';

    return `${base.replace(/\/$/, '')}/book/${token}`;
  }

  // Added by code, so the model can't invent a link and an edit can't break it
  withBookingLink(body: string, token: string) {
    return `${body}\n\nPick a time here: ${this.bookingUrl(token)}`;
  }

  async hasBookedMeeting(candidateId: string) {
    const booked = await this.prisma.meeting.count({
      where: { candidateId, status: MeetingStatus.BOOKED },
    });
    return booked > 0;
  }

  // Reuses a link that's still open, so one candidate never holds two
  async prepare(candidateId: string, conversationId: string, replyId: string) {
    if (await this.hasBookedMeeting(candidateId)) return;

    const open = await this.prisma.meeting.findFirst({
      where: { candidateId, status: { in: OPEN_STATUSES } },
    });

    if (open) {
      await this.prisma.meeting.update({
        where: { id: open.id },
        data: { replyId },
      });
      return;
    }

    await this.prisma.meeting.create({
      data: {
        candidateId,
        conversationId,
        replyId,
        token: randomBytes(TOKEN_BYTES).toString('hex'),
      },
    });
  }

  async markLinkSent(meetingId: string) {
    await this.prisma.meeting.updateMany({
      where: { id: meetingId, status: MeetingStatus.DRAFTED },
      data: { status: MeetingStatus.LINK_SENT },
    });
  }

  async discardDraft(replyId: string) {
    await this.prisma.meeting.updateMany({
      where: { replyId, status: MeetingStatus.DRAFTED },
      data: { status: MeetingStatus.CANCELLED },
    });
  }

  async cancelOpen(candidateId: string) {
    await this.prisma.meeting.updateMany({
      where: {
        candidateId,
        status: { in: [...OPEN_STATUSES, MeetingStatus.BOOKED] },
      },
      data: { status: MeetingStatus.CANCELLED },
    });
  }

  private async findByToken(token: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { token },
      include: { candidate: { include: { job: { include: { user: true } } } } },
    });

    // A link that hasn't gone out looks the same as one that never existed
    if (!meeting || meeting.status === MeetingStatus.DRAFTED) {
      throw new NotFoundException('This booking link is not valid');
    }
    return meeting;
  }

  private async takenSlots(userId: string) {
    const booked = await this.prisma.meeting.findMany({
      where: {
        status: MeetingStatus.BOOKED,
        candidate: { job: { userId } },
        startsAt: { not: null },
      },
      select: { startsAt: true },
    });
    return new Set(booked.map(({ startsAt }) => startsAt?.getTime()));
  }

  // Public, so it returns only what the candidate needs to choose a time
  async publicView(token: string) {
    const meeting = await this.findByToken(token);
    const { candidate } = meeting;
    const { job } = candidate;

    const taken = await this.takenSlots(job.userId);
    const slots =
      meeting.status === MeetingStatus.LINK_SENT
        ? upcomingSlots().filter((slot) => !taken.has(slot.getTime()))
        : [];

    return {
      status: meeting.status,
      startsAt: meeting.startsAt,
      firstName: candidate.name?.split(' ')[0] ?? null,
      jobTitle: job.title,
      hostName: job.user.name ?? job.user.email,
      slots,
    };
  }

  async book(token: string, startsAt: Date) {
    const meeting = await this.findByToken(token);
    const { candidate } = meeting;

    if (candidate.status === CandidateStatus.UNSUBSCRIBED) {
      throw new ConflictException('This booking link is no longer active');
    }

    const offered = upcomingSlots().some(
      (slot) => slot.getTime() === startsAt.getTime(),
    );
    const taken = await this.takenSlots(candidate.job.userId);

    if (!offered || taken.has(startsAt.getTime())) {
      throw new ConflictException(
        'That time is no longer available. Please pick another.',
      );
    }

    // The claim stops a double click or a second tab booking twice
    const { count } = await this.prisma.meeting.updateMany({
      where: { id: meeting.id, status: MeetingStatus.LINK_SENT },
      data: { status: MeetingStatus.BOOKED, startsAt },
    });
    if (count === 0) {
      throw new ConflictException('This meeting has already been booked');
    }

    if (BOOKABLE_FROM.includes(candidate.status)) {
      await this.candidates.changeStatus(
        candidate,
        CandidateStatus.MEETING_BOOKED,
        ActivityActor.SYSTEM,
      );
    }

    await this.prisma.activityLog.create({
      data: {
        jobId: candidate.jobId,
        candidateId: candidate.id,
        actor: ActivityActor.SYSTEM,
        type: ActivityType.MEETING_BOOKED,
        summary: `${candidate.name ?? 'A candidate'} booked a meeting`,
      },
    });

    await this.chat.appendMessage(meeting.conversationId, {
      role: MessageRole.ASSISTANT,
      content: `${candidate.name ?? 'A candidate'} booked a meeting.`,
      cardType: CardType.MEETING_BOOKED,
      meetingId: meeting.id,
    });

    return this.publicView(token);
  }
}
