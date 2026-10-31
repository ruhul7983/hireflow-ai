import { Panel } from "@/components/dashboard/panel";
import { formatPercentage, funnel, percentage } from "@/lib/demo-dashboard";

export function FunnelChart({ className = "" }: { className?: string }) {
  const largest = funnel[0].count;

  return (
    <Panel
      title="Hiring funnel"
      description="Candidates who reached each stage"
      className={className}
    >
      <ol className="space-y-1.5">
        {funnel.map(({ key, label, count }, index) => {
          const previous = funnel[index - 1];

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
                <span
                  className="block h-full rounded-r bg-brand transition-colors group-hover:bg-brand-strong"
                  style={{ width: `max(2px, ${(count / largest) * 100}%)` }}
                />
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
    </Panel>
  );
}
