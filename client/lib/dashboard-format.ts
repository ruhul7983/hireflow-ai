import type {
  DashboardJob,
  WeekCounts,
  WeeklyMetric,
} from "@/lib/dashboard-types";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const WORK_MODES = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" };

export const PHASE_TONES: Record<DashboardJob["phase"], string> = {
  Sourcing: "bg-warning-soft text-warning-strong",
  Outreach: "bg-brand-soft text-brand-strong",
  Interviewing: "bg-success-soft text-success-strong",
  Hired: "bg-success-soft text-success-strong",
};

export function jobLocation({
  location,
  remotePolicy,
}: Pick<DashboardJob, "location" | "remotePolicy">) {
  const parts = [location, remotePolicy && WORK_MODES[remotePolicy]];
  return parts.filter(Boolean).join(" · ") || "Location not set";
}

export function percentage(part: number, whole: number) {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

export function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

export function weeklySeries(weeks: WeekCounts[], metric: WeeklyMetric) {
  return weeks.map((week) => week[metric]);
}

function sum(weeks: WeekCounts[], metric: WeeklyMetric) {
  return weeks.reduce((total, week) => total + week[metric], 0);
}

// Trends compare the latest half of the chart with the half before it
export function splitPeriods(weeks: WeekCounts[]) {
  const middle = weeks.length / 2;
  return { earlier: weeks.slice(0, middle), recent: weeks.slice(middle) };
}

export function countChange(weeks: WeekCounts[], metric: WeeklyMetric) {
  const { earlier, recent } = splitPeriods(weeks);
  return sum(recent, metric) - sum(earlier, metric);
}

export function rateChange(
  weeks: WeekCounts[],
  part: WeeklyMetric,
  whole: WeeklyMetric,
) {
  const { earlier, recent } = splitPeriods(weeks);
  const before = percentage(sum(earlier, part), sum(earlier, whole));
  const after = percentage(sum(recent, part), sum(recent, whole));

  return before === null || after === null ? null : after - before;
}

export function weekLabel(weekStart: string) {
  return new Date(weekStart).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function timeAgo(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();

  if (elapsed < HOUR_MS) {
    const minutes = Math.max(1, Math.round(elapsed / MINUTE_MS));
    return `${minutes} min ago`;
  }
  if (elapsed < DAY_MS) {
    const hours = Math.round(elapsed / HOUR_MS);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.round(elapsed / DAY_MS);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
