import { Briefcase, CalendarCheck, Mail, Sparkles, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/dashboard/sparkline";
import {
  countChange,
  formatPercentage,
  rateChange,
  weeklySeries,
} from "@/lib/dashboard-format";
import type { Dashboard } from "@/lib/dashboard-types";

type Stat = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
  trend?: number[];
};

function changeLabel(value: number | null, unit = "") {
  if (value === null) return "Not enough data yet";
  return `${value >= 0 ? "+" : ""}${value}${unit} vs prior 4 weeks`;
}

function buildStats({ summary, weeks, jobs }: Dashboard): Stat[] {
  const interviewing = jobs.filter(({ phase }) => phase === "Interviewing");

  return [
    {
      label: "Reply rate",
      value: formatPercentage(summary.replyRate),
      detail: changeLabel(rateChange(weeks, "replied", "contacted"), " pts"),
      icon: Mail,
      tone: "bg-brand-soft text-brand-strong",
      trend: weeklySeries(weeks, "replied"),
    },
    {
      label: "Candidates sourced",
      value: summary.sourced.toString(),
      detail: changeLabel(countChange(weeks, "sourced")),
      icon: Users,
      tone: "bg-brand-soft text-brand-strong",
      trend: weeklySeries(weeks, "sourced"),
    },
    {
      label: "Interested rate",
      value: formatPercentage(summary.interestedRate),
      detail: changeLabel(rateChange(weeks, "interested", "replied"), " pts"),
      icon: Sparkles,
      tone: "bg-success-soft text-success-strong",
      trend: weeklySeries(weeks, "interested"),
    },
    {
      label: "Meetings booked",
      value: summary.meetings.toString(),
      detail: changeLabel(countChange(weeks, "meetings")),
      icon: CalendarCheck,
      tone: "bg-warning-soft text-warning-strong",
      trend: weeklySeries(weeks, "meetings"),
    },
    {
      label: "Hires",
      value: summary.hires.toString(),
      detail: changeLabel(countChange(weeks, "hired")),
      icon: UserCheck,
      tone: "bg-success-soft text-success-strong",
      trend: weeklySeries(weeks, "hired"),
    },
    {
      label: "Open jobs",
      value: summary.openJobs.toString(),
      detail: `${interviewing.length} interviewing now`,
      icon: Briefcase,
      tone: "bg-canvas text-muted",
    },
  ];
}

export function StatCards({ data }: { data: Dashboard }) {
  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {buildStats(data).map(({ label, value, detail, icon: Icon, tone, trend }) => (
        <div
          key={label}
          className="flex flex-col rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <dt className="min-w-0 text-sm font-medium text-muted">{label}</dt>
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          </div>
          <dd className="mt-2 text-3xl font-semibold tracking-tight">{value}</dd>
          {trend && (
            <Sparkline values={trend} className="mt-auto pt-2 text-brand" />
          )}
          <p className={`text-xs text-muted ${trend ? "mt-2" : "mt-auto"}`}>
            {detail}
          </p>
        </div>
      ))}
    </dl>
  );
}
