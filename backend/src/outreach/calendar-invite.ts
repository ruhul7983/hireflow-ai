// src/outreach/calendar-invite.ts
const MEETING_MINUTES = 30;
const MINUTE_MS = 60_000;
const MAX_LINE_LENGTH = 74;

export type MeetingInvite = {
  uid: string;
  summary: string;
  startsAt: Date;
};

type Person = { name: string; email: string };

function calendarTime(date: Date) {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, '');
}

function escapeText(text: string) {
  return text.replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n');
}

// Calendar files limit line length, and a continuation line starts with a space
function foldLine(line: string) {
  const chunks = line.match(new RegExp(`.{1,${MAX_LINE_LENGTH}}`, 'g')) ?? [];
  return chunks.join('\r\n ');
}

export function buildInvite(
  { uid, summary, startsAt }: MeetingInvite,
  organizer: Person,
  attendee: { email: string; name: string | null },
) {
  const endsAt = new Date(startsAt.getTime() + MEETING_MINUTES * MINUTE_MS);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HireFlow AI//Meetings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}@hireflow-ai`,
    `DTSTAMP:${calendarTime(new Date())}`,
    `DTSTART:${calendarTime(startsAt)}`,
    `DTEND:${calendarTime(endsAt)}`,
    `SUMMARY:${escapeText(summary)}`,
    `ORGANIZER;CN=${escapeText(organizer.name)}:mailto:${organizer.email}`,
    `ATTENDEE;CN=${escapeText(attendee.name ?? attendee.email)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${attendee.email}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(foldLine)
    .join('\r\n');
}
