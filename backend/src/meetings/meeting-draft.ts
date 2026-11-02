// src/meetings/meeting-draft.ts
type MeetingDraft = {
  candidateName: string | null;
  senderName: string;
  startsAt: Date | null;
  timeZone: string;
};

function meetingTimeLabel(startsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  }).format(startsAt);
}

// Written by code, so the time in the email is always the one the recruiter picked
export function meetingDraft({
  candidateName,
  senderName,
  startsAt,
  timeZone,
}: MeetingDraft) {
  const greeting = candidateName
    ? `Hi ${candidateName.split(' ')[0]},`
    : 'Hi there,';

  const plan = startsAt
    ? `Let's meet on ${meetingTimeLabel(startsAt, timeZone)}. A calendar invite is attached.\n\nIf that time doesn't work for you, just reply with one that does.`
    : "I'd be glad to meet. Please pick a time that works for you using the booking link below.";

  return `${greeting}\n\nThanks for getting back to me. ${plan}\n\nBest regards,\n${senderName}`;
}
