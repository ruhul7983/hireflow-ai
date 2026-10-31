import { CalendarDays, Gauge } from "lucide-react";
import { ActionButtons } from "@/components/chat/action-buttons";
import type { PendingAction } from "@/lib/chat-types";

const STATUS_NOTES: Record<PendingAction["status"], string> = {
  PENDING: "",
  EXECUTED: "Confirmed.",
  CANCELLED: "Cancelled. Nothing was written or sent.",
  FAILED: "This could not be started.",
};

type CampaignProposalCardProps = {
  action: PendingAction;
  onChanged: () => void;
};

export function CampaignProposalCard({
  action,
  onChanged,
}: CampaignProposalCardProps) {
  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div>
        <p className="font-semibold">{action.campaignName}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            {action.dayOffsets.map((day) => `Day ${day}`).join(", ")}
          </span>
          <span className="flex items-center gap-1.5">
            <Gauge className="size-4" aria-hidden />
            Up to {action.dailyLimit} emails a day
          </span>
        </div>
        {action.instructions && (
          <p className="mt-2 text-sm text-muted">Focus: {action.instructions}</p>
        )}
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {action.candidates.map(({ candidate }) => (
          <li
            key={candidate.id}
            className="flex items-center justify-between gap-4 py-2 text-sm"
          >
            <span className="min-w-0 truncate font-medium">
              {candidate.name ?? "Name not shown"}
            </span>
            <span className="min-w-0 truncate text-muted">{candidate.email}</span>
          </li>
        ))}
      </ul>

      {action.status === "PENDING" ? (
        <ActionButtons
          actionId={action.id}
          confirmLabel="Write drafts"
          onChanged={onChanged}
        />
      ) : (
        <p className="text-sm text-muted">{STATUS_NOTES[action.status]}</p>
      )}
    </div>
  );
}
