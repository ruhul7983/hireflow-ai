import { ActionButtons } from "@/components/chat/action-buttons";
import { CsvUploadButton } from "@/components/chat/csv-upload-button";
import type { PendingAction } from "@/lib/chat-types";

type SourcingPromptCardProps = {
  action: PendingAction;
  conversationId: string;
  onChanged: () => void;
};

export function SourcingPromptCard({
  action,
  conversationId,
  onChanged,
}: SourcingPromptCardProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-4">
      {action.status === "PENDING" && (
        <ActionButtons
          actionId={action.id}
          confirmLabel="Start search"
          cancelLabel="Not now"
          onChanged={onChanged}
        />
      )}
      {action.jobId && (
        <CsvUploadButton
          jobId={action.jobId}
          conversationId={conversationId}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
