import { ActionButtons } from "@/components/chat/action-buttons";
import { statusLabel } from "@/lib/candidate-status";
import type { PendingAction } from "@/lib/chat-types";

const STATUS_NOTES: Record<PendingAction["status"], string> = {
  PENDING: "",
  EXECUTED: "Confirmed.",
  CANCELLED: "Cancelled. Nothing changed.",
  FAILED: "This could not be completed.",
};

type DecisionCardProps = {
  action: PendingAction;
  onChanged: () => void;
};

export function DecisionCard({ action, onChanged }: DecisionCardProps) {
  const count = action.candidates.length;
  const label =
    action.decision === "ACCEPTED"
      ? `Accept ${count}`
      : action.decision === "REJECTED"
        ? `Reject ${count}`
        : `Mark as ${statusLabel(action.decision ?? "").toLowerCase()}`;

  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <ul className="divide-y divide-line">
        {action.candidates.map(({ candidate }) => (
          <li
            key={candidate.id}
            className="flex items-center justify-between gap-4 py-2 text-sm"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {candidate.name ?? "Name not shown"}
              </span>
              {candidate.headline && (
                <span className="block truncate text-xs text-muted">
                  {candidate.headline}
                </span>
              )}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {candidate.score ?? "—"}
            </span>
          </li>
        ))}
      </ul>

      {action.status === "PENDING" ? (
        <ActionButtons
          actionId={action.id}
          confirmLabel={label}
          onChanged={onChanged}
        />
      ) : (
        <p className="text-sm text-muted">{STATUS_NOTES[action.status]}</p>
      )}
    </div>
  );
}
