import Link from "next/link";
import { Bot, Cog, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { timeAgo } from "@/lib/dashboard-format";
import type { ActivityItem } from "@/lib/dashboard-types";

const ACTORS: Record<
  ActivityItem["actor"],
  { label: string; icon: LucideIcon; tone: string }
> = {
  AI: { label: "AI", icon: Bot, tone: "bg-brand-soft text-brand-strong" },
  RECRUITER: {
    label: "You",
    icon: UserRound,
    tone: "bg-success-soft text-success-strong",
  },
  SYSTEM: { label: "System", icon: Cog, tone: "bg-canvas text-muted" },
};

type ActivityFeedProps = {
  activity: ActivityItem[];
  className?: string;
};

export function ActivityFeed({ activity, className = "" }: ActivityFeedProps) {
  return (
    <Panel
      title="Recent activity"
      aside={
        <Link
          href="/activity"
          className="text-sm font-medium text-brand-strong hover:underline"
        >
          View all
        </Link>
      }
      className={className}
    >
      {activity.length === 0 ? (
        <p className="text-sm text-muted">Nothing has happened yet.</p>
      ) : (
        <ol className="space-y-4">
          {activity.map(({ id, actor, summary, job, createdAt }) => {
            const { label, icon: Icon, tone } = ACTORS[actor];

            return (
              <li key={id} className="flex gap-3">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}
                >
                  <Icon className="size-4" aria-label={label} />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{summary}</p>
                  <p className="mt-0.5 text-xs text-muted">{job.title}</p>
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted">
                  {timeAgo(createdAt)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
