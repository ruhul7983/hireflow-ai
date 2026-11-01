import { ActionButtons } from "@/components/chat/action-buttons";
import type { PendingAction } from "@/lib/chat-types";

const STATUS_NOTES: Record<PendingAction["status"], string> = {
  PENDING: "",
  EXECUTED: "Confirmed.",
  CANCELLED: "Cancelled. Nothing changed.",
  FAILED: "This could not be completed.",
};

type ConfirmationCardProps = {
  action: PendingAction;
  onChanged: () => void;
};

export function ConfirmationCard({ action, onChanged }: ConfirmationCardProps) {
  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div>
        <p className="font-semibold">{action.title}</p>
        {action.detail && (
          <p className="mt-1 text-sm break-words whitespace-pre-wrap text-muted">
            {action.detail}
          </p>
        )}
      </div>

      {action.status === "PENDING" ? (
        <ActionButtons
          actionId={action.id}
          confirmLabel={action.confirmLabel ?? "Confirm"}
          onChanged={onChanged}
        />
      ) : (
        <p className="text-sm text-muted">{STATUS_NOTES[action.status]}</p>
      )}
    </div>
  );
}
