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
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { nextStatuses } from 'src/chat/candidate-status';
import { CandidatesService } from 'src/chat/candidates.service';
import { ChatService } from 'src/chat/chat.service';
import { containsText, JobPageQueryDto, paginate } from 'src/common/pagination';
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

export const OPEN_STATUSES: MeetingStatus[] = [
  MeetingStatus.DRAFTED,
  MeetingStatus.LINK_SENT,
];

export const MEETING_WINDOWS = ['upcoming', 'past'] as const;
export type MeetingWindow = (typeof MEETING_WINDOWS)[number];

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

  // Upcoming reads soonest first. Everything else reads most recent first.
  async list(
    userId: string,
    query: JobPageQueryDto & { status?: MeetingStatus; when?: MeetingWindow },
  ) {
    const { search, status, jobId, when } = query;
    const text = search ? containsText(search) : undefined;
    const now = new Date();

    const where: Prisma.MeetingWhereInput = {
      status,
      candidate: {
        jobId,
        job: { userId },
        ...(text && {
          OR: [
            { name: text },
            { email: text },
            { job: { title: text } },
          ],
        }),
      },
      ...(when === 'upcoming' && {
        startsAt: { gte: now },
        status: status ?? MeetingStatus.BOOKED,
      }),
      ...(when === 'past' && { startsAt: { lt: now } }),
    };

    const page = await paginate(
      query,
      await this.prisma.meeting.count({ where }),
      (range) =>
        this.prisma.meeting.findMany({
          ...range,
          where,
          orderBy: [
            {
              startsAt: {
                sort: when === 'upcoming' ? 'asc' : 'desc',
                nulls: 'last',
              },
            },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
          select: {
            id: true,
            status: true,
            startsAt: true,
            conversationId: true,
            candidate: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
                job: { select: { id: true, title: true } },
              },
            },
          },
        }),
    );

    return {
      ...page,
      items: page.items.map((meeting) => ({
        ...meeting,
        candidate: {
          ...meeting.candidate,
          nextStatuses: nextStatuses(meeting.candidate.status),
        },
      })),
    };
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

  // Runs once the recruiter's email has gone out, so the time is never promised early
  async confirmTime(meetingId: string) {
    const { count } = await this.prisma.meeting.updateMany({
      where: { id: meetingId, status: { in: OPEN_STATUSES } },
      data: { status: MeetingStatus.BOOKED },
    });
    if (count === 0) return;

    const meeting = await this.prisma.meeting.findUniqueOrThrow({
      where: { id: meetingId },
      include: { candidate: true },
    });
    const name = meeting.candidate.name ?? 'the candidate';

    await this.recordBooking(
      meeting,
      ActivityActor.RECRUITER,
      `Set a meeting with ${name}`,
      `The meeting with ${name} is set, and the invite has gone out.`,
    );
  }

  private async recordBooking(
    meeting: {
      id: string;
      conversationId: string;
      candidate: Parameters<CandidatesService['changeStatus']>[0];
    },
    actor: ActivityActor,
    summary: string,
    content: string,
  ) {
    const { candidate } = meeting;

    if (BOOKABLE_FROM.includes(candidate.status)) {
      await this.candidates.changeStatus(
        candidate,
        CandidateStatus.MEETING_BOOKED,
        actor,
      );
    }

    await this.prisma.activityLog.create({
      data: {
        jobId: candidate.jobId,
        candidateId: candidate.id,
        actor,
        type: ActivityType.MEETING_BOOKED,
        summary,
      },
    });

    await this.chat.appendMessage(meeting.conversationId, {
      role: MessageRole.ASSISTANT,
      content,
      cardType: CardType.MEETING_BOOKED,
      meetingId: meeting.id,
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

    const booked = `${candidate.name ?? 'A candidate'} booked a meeting`;
    await this.recordBooking(
      meeting,
      ActivityActor.SYSTEM,
      booked,
      `${booked}.`,
    );

    return this.publicView(token);
  }
}
