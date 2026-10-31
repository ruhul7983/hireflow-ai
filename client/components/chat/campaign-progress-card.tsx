"use client";

import { useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  LoaderCircle,
  Pause,
  Play,
} from "lucide-react";
import { secondaryButton } from "@/components/chat/action-buttons";
import { useCampaign } from "@/components/chat/use-campaign";
import { api, errorMessage } from "@/lib/api";
import type { OutboundEmail } from "@/lib/chat-types";

const STATUS_LABELS: Record<string, string> = {
  SENDING: "Sending",
  PAUSED: "Paused",
  COMPLETED: "Finished",
};

const EMAIL_LABELS: Record<OutboundEmail["status"], string> = {
  DRAFT: "Draft",
  APPROVED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  FAILED: "Failed",
};

const EMAIL_TONES: Record<OutboundEmail["status"], string> = {
  DRAFT: "bg-canvas text-muted",
  APPROVED: "bg-brand-soft text-brand-strong",
  SENDING: "bg-warning-soft text-warning-strong",
  SENT: "bg-success-soft text-success-strong",
  FAILED: "bg-danger-soft text-danger-strong",
};

type CampaignProgressCardProps = {
  campaignId: string;
  refreshKey: number;
  onChanged: () => void;
};

export function CampaignProgressCard({
  campaignId,
  refreshKey,
  onChanged,
}: CampaignProgressCardProps) {
  const { campaign, error } = useCampaign(campaignId, refreshKey);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!campaign) {
    return (
      <div className="rounded-xl border border-line p-4 text-sm text-muted">
        {error ?? "Loading campaign…"}
      </div>
    );
  }

  const { emails } = campaign;
  const sent = emails.filter(({ status }) => status === "SENT").length;
  const failed = emails.filter(({ status }) => status === "FAILED").length;
  const share = emails.length > 0 ? (sent / emails.length) * 100 : 0;
  const isSending = campaign.status === "SENDING";
  const canToggle = isSending || campaign.status === "PAUSED";
  const isDone = campaign.status === "COMPLETED";
  const label =
    isDone && failed > 0
      ? sent > 0
        ? "Finished with failures"
        : "Could not send"
      : (STATUS_LABELS[campaign.status] ?? campaign.status);

  function names(candidateId: string) {
    const recipient = campaign?.recipients.find(
      ({ candidate }) => candidate.id === candidateId,
    );
    return recipient?.candidate.name ?? recipient?.candidate.email ?? "Candidate";
  }

  function dayOf(stepId: string) {
    return campaign?.steps.find(({ id }) => id === stepId)?.dayOffset;
  }

  async function togglePause() {
    setPending(true);
    setActionError(null);
    try {
      await api(`/campaigns/${campaignId}/${isSending ? "pause" : "resume"}`, {
        method: "POST",
      });
      onChanged();
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
    setPending(false);
  }

  return (
    <div className="rounded-xl border border-line">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold" role="status">
            {isDone && failed > 0 ? (
              <CircleAlert className="size-4 text-danger-strong" aria-hidden />
            ) : isDone ? (
              <CircleCheck className="size-4 text-success-strong" aria-hidden />
            ) : isSending ? (
              <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
            ) : null}
            {label}
          </p>
          {canToggle && (
            <button
              type="button"
              onClick={togglePause}
              disabled={pending}
              className={`${secondaryButton} flex items-center gap-2`}
            >
              {isSending ? (
                <Pause className="size-4" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
              {isSending ? "Pause" : "Resume"}
            </button>
          )}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-canvas">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${share}%` }}
          />
        </div>

        <p className="text-sm text-muted">
          {sent} of {emails.length} sent
          {failed > 0 && `, ${failed} failed`}, up to {campaign.dailyLimit} a day
        </p>
        {actionError && (
          <p role="alert" className="text-sm font-medium text-danger-strong">
            {actionError}
          </p>
        )}
      </div>

      <div className="max-h-72 overflow-auto border-t border-line">
        <table className="w-full min-w-md text-sm">
          <thead className="sticky top-0 bg-surface text-left text-muted shadow-[0_1px_0_var(--color-line)]">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Candidate</th>
              <th scope="col" className="py-2 pr-4 font-medium">Step</th>
              <th scope="col" className="py-2 pr-4 font-medium">Status</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id} className="border-t border-line align-top">
                <th scope="row" className="max-w-48 truncate px-4 py-2 text-left font-medium">
                  {names(email.candidateId)}
                </th>
                <td className="py-2 pr-4 whitespace-nowrap text-muted">
                  Day {dayOf(email.campaignStepId)}
                </td>
                <td className="py-2 pr-4">
                  <span
                    title={email.error ?? undefined}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EMAIL_TONES[email.status]}`}
                  >
                    {EMAIL_LABELS[email.status]}
                  </span>
                  {email.error && (
                    <span className="mt-1 block text-xs text-danger-strong">
                      {email.error}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">
                  {email.previewUrl ? (
                    <a
                      href={email.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                    >
                      Open
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
