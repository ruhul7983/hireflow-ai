import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { RunStatus, SourcingRun } from "@/lib/chat-types";

const STATUS_LABELS: Record<RunStatus, string> = {
  QUEUED: "Waiting to start",
  SOURCING: "Finding candidates",
  SCORING: "Scoring candidates",
  COMPLETED: "Finished",
  FAILED: "Stopped",
};

export function ProgressCard({ run }: { run: SourcingRun }) {
  const isDone = run.status === "COMPLETED";
  const isFailed = run.status === "FAILED";
  const share =
    run.foundCount > 0 ? (run.scoredCount / run.foundCount) * 100 : 0;

  const counts = [
    `Found ${run.foundCount}`,
    `scored ${run.scoredCount}`,
    run.duplicateCount > 0 && `${run.duplicateCount} duplicates removed`,
    run.skippedCount > 0 && `${run.skippedCount} rows skipped`,
  ].filter(Boolean);

  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex items-center gap-2 text-sm font-semibold" role="status">
        {isFailed ? (
          <CircleAlert className="size-4 text-danger-strong" aria-hidden />
        ) : isDone ? (
          <CircleCheck className="size-4 text-success-strong" aria-hidden />
        ) : (
          <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
        )}
        {STATUS_LABELS[run.status]}
        {run.fileName && (
          <span className="truncate font-normal text-muted">{run.fileName}</span>
        )}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${isDone ? 100 : share}%` }}
        />
      </div>

      <p className="text-sm text-muted">{counts.join(", ")}</p>
      {run.error && (
        <p className="text-sm font-medium text-danger-strong">{run.error}</p>
      )}
    </div>
  );
}
