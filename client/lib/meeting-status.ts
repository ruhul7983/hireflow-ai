import type { MeetingStatus } from "@/lib/chat-types";

export const MEETING_STATUSES: Record<
  MeetingStatus,
  { label: string; tone: string }
> = {
  DRAFTED: {
    label: "Reply waiting",
    tone: "bg-warning-soft text-warning-strong",
  },
  LINK_SENT: { label: "Link sent", tone: "bg-brand-soft text-brand-strong" },
  BOOKED: { label: "Booked", tone: "bg-success-soft text-success-strong" },
  COMPLETED: { label: "Completed", tone: "bg-canvas text-muted" },
  CANCELLED: { label: "Cancelled", tone: "bg-danger-soft text-danger-strong" },
};

export const MEETING_WINDOWS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];
