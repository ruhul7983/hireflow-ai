// src/chat/candidate-status.ts
import { CandidateStatus } from '@prisma/client';

const {
  ACCEPTED,
  HIRED,
  INTERESTED,
  INTERVIEWED,
  MEETING_BOOKED,
  NOT_INTERESTED,
  REJECTED,
  REPLIED,
  SHORTLISTED,
  UNSUBSCRIBED,
} = CandidateStatus;

// Every move a recruiter can make. The UI and chat both read this, so they can't
// disagree. Contacted isn't a target, because only sending an email sets it.
const NEXT_STATUSES: Record<CandidateStatus, CandidateStatus[]> = {
  SOURCED: [ACCEPTED, REJECTED],
  ACCEPTED: [REJECTED],
  REJECTED: [ACCEPTED],
  CONTACTED: [REPLIED, INTERESTED, NOT_INTERESTED, MEETING_BOOKED, INTERVIEWED, REJECTED, UNSUBSCRIBED],
  REPLIED: [INTERESTED, NOT_INTERESTED, MEETING_BOOKED, INTERVIEWED, REJECTED, UNSUBSCRIBED],
  INTERESTED: [NOT_INTERESTED, MEETING_BOOKED, INTERVIEWED, REJECTED, UNSUBSCRIBED],
  NOT_INTERESTED: [INTERESTED, REJECTED, UNSUBSCRIBED],
  MEETING_BOOKED: [INTERVIEWED, REJECTED, UNSUBSCRIBED],
  INTERVIEWED: [SHORTLISTED, HIRED, REJECTED, UNSUBSCRIBED],
  SHORTLISTED: [HIRED, INTERVIEWED, REJECTED, UNSUBSCRIBED],
  HIRED: [SHORTLISTED],
  UNSUBSCRIBED: [],
};

export const RECRUITER_TARGETS = [
  ...new Set(Object.values(NEXT_STATUSES).flat()),
].sort();

export function nextStatuses(status: CandidateStatus) {
  return NEXT_STATUSES[status];
}

export function statusLabel(status: CandidateStatus) {
  const words = status.toLowerCase().replaceAll('_', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
