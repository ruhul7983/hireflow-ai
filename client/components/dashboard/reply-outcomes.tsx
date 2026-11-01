import { Panel } from "@/components/dashboard/panel";
import { formatPercentage, percentage } from "@/lib/dashboard-format";
import type { ReplyOutcome } from "@/lib/dashboard-types";

// A radius of 15.915 makes the circumference 100, so dash lengths read as percentages
const RADIUS = 15.915;
const SEGMENT_GAP = 0.8;

// In the validated chart colour order, so neighbouring segments stay distinct
const OUTCOMES: {
  key: ReplyOutcome["classification"];
  label: string;
  color: string;
}[] = [
  { key: "WANTS_MEETING", label: "Wants a meeting", color: "var(--color-brand)" },
  { key: "INTERESTED", label: "Interested", color: "var(--color-success)" },
  { key: "QUESTION", label: "Question", color: "var(--color-warning)" },
  { key: "NOT_INTERESTED", label: "Not interested", color: "var(--color-danger)" },
  { key: "UNSUBSCRIBE", label: "Unsubscribe", color: "var(--color-info)" },
];

type ReplyOutcomesProps = {
  outcomes: ReplyOutcome[];
  className?: string;
};

export function ReplyOutcomes({ outcomes, className = "" }: ReplyOutcomesProps) {
  const rows = OUTCOMES.map((outcome) => ({
    ...outcome,
    count:
      outcomes.find(({ classification }) => classification === outcome.key)
        ?.count ?? 0,
  }));
  const total = rows.reduce((sum, { count }) => sum + count, 0);

  const segments = rows.map((row, index) => ({
    ...row,
    share: total === 0 ? 0 : (row.count / total) * 100,
    offset: rows
      .slice(0, index)
      .reduce((sum, { count }) => sum + (count / Math.max(total, 1)) * 100, 0),
  }));

  return (
    <Panel
      title="Reply outcomes"
      description="How the AI classified each reply"
      className={className}
    >
      {total === 0 ? (
        <p className="text-sm text-muted">No replies yet.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5">
          <div className="relative size-36 shrink-0">
            <svg aria-hidden viewBox="0 0 36 36" className="size-full -rotate-90">
              {segments
                .filter(({ count }) => count > 0)
                .map(({ key, color, share, offset }) => (
                  <circle
                    key={key}
                    cx="18"
                    cy="18"
                    r={RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth="4"
                    strokeDasharray={`${Math.max(share - SEGMENT_GAP, 0.5)} ${100 - share + SEGMENT_GAP}`}
                    strokeDashoffset={-offset}
                  />
                ))}
            </svg>
            <p className="absolute inset-0 grid place-content-center text-center">
              <span className="text-2xl font-semibold tracking-tight">{total}</span>
              <span className="text-xs text-muted">
                {total === 1 ? "reply" : "replies"}
              </span>
            </p>
          </div>

          <ul className="min-w-44 flex-1 space-y-2 text-sm">
            {rows.map(({ key, label, count, color }) => (
              <li key={key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                <span className="min-w-0 flex-1 truncate text-muted">{label}</span>
                <span className="font-semibold tabular-nums">{count}</span>
                <span className="w-9 text-right text-xs text-muted tabular-nums">
                  {formatPercentage(percentage(count, total))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
