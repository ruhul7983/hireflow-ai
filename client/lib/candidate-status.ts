export const CANDIDATE_STATUSES = [
  "SOURCED",
  "ACCEPTED",
  "REJECTED",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "NOT_INTERESTED",
  "MEETING_BOOKED",
  "INTERVIEWED",
  "SHORTLISTED",
  "HIRED",
  "UNSUBSCRIBED",
] as const;

const POSITIVE = ["ACCEPTED", "INTERESTED", "SHORTLISTED", "HIRED"];
const ENDED = ["REJECTED", "NOT_INTERESTED", "UNSUBSCRIBED"];

export function statusLabel(status: string) {
  const words = status.toLowerCase().replaceAll("_", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function statusTone(status: string) {
  if (status === "SOURCED") return "bg-canvas text-muted";
  if (POSITIVE.includes(status)) return "bg-success-soft text-success-strong";
  if (ENDED.includes(status)) return "bg-danger-soft text-danger-strong";
  return "bg-brand-soft text-brand-strong";
}

export function scoreTone(score: number) {
  if (score >= 70) return "bg-success-soft text-success-strong";
  if (score >= 40) return "bg-warning-soft text-warning-strong";
  return "bg-canvas text-muted";
}
