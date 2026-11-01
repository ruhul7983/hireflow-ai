import type { Campaign } from "@/lib/chat-types";

export const CAMPAIGN_STATUSES: Record<
  Campaign["status"],
  { label: string; tone: string }
> = {
  DRAFTING: { label: "Writing drafts", tone: "bg-canvas text-muted" },
  DRAFT: {
    label: "Waiting for approval",
    tone: "bg-warning-soft text-warning-strong",
  },
  SENDING: { label: "Sending", tone: "bg-brand-soft text-brand-strong" },
  PAUSED: { label: "Paused", tone: "bg-warning-soft text-warning-strong" },
  COMPLETED: { label: "Finished", tone: "bg-success-soft text-success-strong" },
  CANCELLED: { label: "Cancelled", tone: "bg-canvas text-muted" },
  FAILED: { label: "Failed", tone: "bg-danger-soft text-danger-strong" },
};
