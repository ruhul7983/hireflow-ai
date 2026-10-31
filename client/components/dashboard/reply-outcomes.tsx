import { Panel } from "@/components/dashboard/panel";
import {
  formatPercentage,
  percentage,
  replyOutcomes,
  summary,
} from "@/lib/demo-dashboard";

// A radius of 15.915 makes the circumference 100, so dash lengths read as percentages
const RADIUS = 15.915;
const SEGMENT_GAP = 0.8;

const shares = replyOutcomes.map(({ count }) => (count / summary.replied) * 100);

const segments = replyOutcomes.map(({ label, color }, index) => ({
  label,
  color,
  share: shares[index],
  offset: shares.slice(0, index).reduce((sum, share) => sum + share, 0),
}));

export function ReplyOutcomes({ className = "" }: { className?: string }) {
  return (
    <Panel
      title="Reply outcomes"
      description="How the AI classified each reply"
      className={className}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5">
        <div className="relative size-36 shrink-0">
          <svg aria-hidden viewBox="0 0 36 36" className="size-full -rotate-90">
            {segments.map(({ label, color, share, offset }) => (
              <circle
                key={label}
                cx="18"
                cy="18"
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeDasharray={`${share - SEGMENT_GAP} ${100 - share + SEGMENT_GAP}`}
                strokeDashoffset={-offset}
              />
            ))}
          </svg>
          <p className="absolute inset-0 grid place-content-center text-center">
            <span className="text-2xl font-semibold tracking-tight">
              {summary.replied}
            </span>
            <span className="text-xs text-muted">replies</span>
          </p>
        </div>

        <ul className="min-w-44 flex-1 space-y-2 text-sm">
          {replyOutcomes.map(({ label, count, color }) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span className="min-w-0 flex-1 truncate text-muted">{label}</span>
              <span className="font-semibold tabular-nums">{count}</span>
              <span className="w-9 text-right text-xs text-muted tabular-nums">
                {formatPercentage(percentage(count, summary.replied))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
