import { Briefcase, CalendarCheck, Mail, Sparkles, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/dashboard/sparkline";
import { formatPercentage, summary, weeklySeries } from "@/lib/demo-dashboard";

type Stat = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
  trend?: number[];
};

function signed(value: number, unit = "") {
  return `${value >= 0 ? "+" : ""}${value}${unit}`;
}

const STATS: Stat[] = [
  {
    label: "Reply rate",
    value: formatPercentage(summary.replyRate),
    detail: `${signed(summary.replyRateChange, " pts")} vs prior 4 weeks`,
    icon: Mail,
    tone: "bg-brand-soft text-brand-strong",
    trend: weeklySeries("replied"),
  },
  {
    label: "Candidates sourced",
    value: summary.sourced.toString(),
    detail: `${signed(summary.sourcedChange, "%")} vs prior 4 weeks`,
    icon: Users,
    tone: "bg-brand-soft text-brand-strong",
    trend: weeklySeries("sourced"),
  },
  {
    label: "Interested rate",
    value: formatPercentage(summary.interestedRate),
    detail: `${signed(summary.interestedRateChange, " pts")} vs prior 4 weeks`,
    icon: Sparkles,
    tone: "bg-success-soft text-success-strong",
    trend: weeklySeries("interested"),
  },
  {
    label: "Meetings booked",
    value: summary.meetings.toString(),
    detail: `${signed(summary.meetingsChange)} vs prior 4 weeks`,
    icon: CalendarCheck,
    tone: "bg-warning-soft text-warning-strong",
    trend: weeklySeries("meetings"),
  },
  {
    label: "Hires",
    value: summary.hires.toString(),
    detail: `${signed(summary.hiresChange)} vs prior 4 weeks`,
    icon: UserCheck,
    tone: "bg-success-soft text-success-strong",
    trend: weeklySeries("hired"),
  },
  {
    label: "Open jobs",
    value: summary.openJobs.toString(),
    detail: `${summary.interviewingJobs} interviewing now`,
    icon: Briefcase,
    tone: "bg-canvas text-muted",
  },
];

export function StatCards() {
  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {STATS.map(({ label, value, detail, icon: Icon, tone, trend }) => (
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
