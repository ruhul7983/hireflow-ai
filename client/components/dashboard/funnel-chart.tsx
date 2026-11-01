import { Panel } from "@/components/dashboard/panel";
import { formatPercentage, percentage } from "@/lib/dashboard-format";
import type { Dashboard } from "@/lib/dashboard-types";

type FunnelChartProps = Pick<Dashboard, "stages" | "exits"> & {
  className?: string;
};

export function FunnelChart({ stages, exits, className = "" }: FunnelChartProps) {
  const largest = Math.max(stages[0]?.count ?? 0, 1);

  return (
    <Panel
      title="Hiring funnel"
      description="The furthest stage each candidate reached"
      className={className}
    >
      <ol className="space-y-1.5">
        {stages.map(({ key, label, count }, index) => {
          const previous = stages[index - 1];

          return (
            <li
              key={key}
              tabIndex={0}
              className="group relative flex items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <span className="w-28 shrink-0 truncate text-sm text-muted">
                {label}
              </span>
              <span className="h-5 min-w-0 flex-1 rounded-r bg-canvas">
                {count > 0 && (
                  <span
                    className="block h-full rounded-r bg-brand transition-colors group-hover:bg-brand-strong"
                    style={{ width: `max(2px, ${(count / largest) * 100}%)` }}
                  />
                )}
              </span>
              <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                {count}
              </span>

              {previous && (
                <span className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 hidden rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white group-hover:block group-focus-visible:block">
                  {formatPercentage(percentage(count, previous.count))} of{" "}
                  {previous.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-muted">
        Left the process: {exits.rejected} rejected, {exits.notInterested} not
        interested, {exits.unsubscribed} unsubscribed
      </p>
    </Panel>
  );
}
