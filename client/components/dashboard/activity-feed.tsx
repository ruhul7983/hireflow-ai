import { Bot, UserRound } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { activity } from "@/lib/demo-dashboard";

export function ActivityFeed({ className = "" }: { className?: string }) {
  return (
    <Panel title="Recent activity" className={className}>
      <ol className="space-y-4">
        {activity.map(({ id, actor, summary, job, time }) => {
          const Icon = actor === "AI" ? Bot : UserRound;

          return (
            <li key={id} className="flex gap-3">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                  actor === "AI"
                    ? "bg-brand-soft text-brand-strong"
                    : "bg-success-soft text-success-strong"
                }`}
              >
                <Icon className="size-4" aria-label={actor} />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{summary}</p>
                <p className="mt-0.5 text-xs text-muted">{job}</p>
              </div>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted">
                {time}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
