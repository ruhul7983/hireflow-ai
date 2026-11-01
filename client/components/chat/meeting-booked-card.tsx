import { CalendarCheck } from "lucide-react";
import type { MeetingSummary } from "@/lib/chat-types";

export function MeetingBookedCard({ meeting }: { meeting: MeetingSummary }) {
  const when = meeting.startsAt
    ? new Date(meeting.startsAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "Time not set";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success-strong">
        <CalendarCheck className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {meeting.candidate.name ?? meeting.candidate.email}
        </p>
        <p className="text-sm text-muted">
          {meeting.status === "CANCELLED" ? "Cancelled" : when}
        </p>
      </div>
    </div>
  );
}
