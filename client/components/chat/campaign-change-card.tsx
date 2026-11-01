import { ActionButtons } from "@/components/chat/action-buttons";
import type { PendingAction } from "@/lib/chat-types";

const STATUS_NOTES: Record<PendingAction["status"], string> = {
  PENDING: "",
  EXECUTED: "Confirmed.",
  CANCELLED: "Cancelled. Nothing changed.",
  FAILED: "This could not be completed.",
};

const CHANGE_LABELS = {
  PAUSE: "Pause campaign",
  RESUME: "Resume campaign",
  STOP: "Stop campaign",
};

type CampaignChangeCardProps = {
  action: PendingAction;
  onChanged: () => void;
};

export function CampaignChangeCard({
  action,
  onChanged,
}: CampaignChangeCardProps) {
  const { campaignChange, dailyLimit } = action;
  const label = campaignChange ? CHANGE_LABELS[campaignChange] : "Change limit";

  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div>
        <p className="font-semibold">{action.campaignName}</p>
        {dailyLimit && campaignChange !== "STOP" && (
          <p className="mt-1 text-sm text-muted">
            New limit: up to {dailyLimit} emails a day
          </p>
        )}
      </div>

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
