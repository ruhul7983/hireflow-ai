"use client";

import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { ActionButtons } from "@/components/chat/action-buttons";
import { useCampaign } from "@/components/chat/use-campaign";
import { api, errorMessage } from "@/lib/api";
import type { OutboundEmail, PendingAction } from "@/lib/chat-types";

const fieldClass =
  "w-full rounded-lg border border-muted/70 bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand/20 disabled:bg-canvas disabled:text-muted";

const STATUS_NOTES: Partial<Record<string, string>> = {
  SENDING: "Approved. These emails can no longer be edited.",
  PAUSED: "Approved. These emails can no longer be edited.",
  COMPLETED: "Approved. The results are in the send tracker below.",
  CANCELLED: "These drafts were discarded. Nothing was sent.",
  FAILED: "The drafts could not be finished. Nothing was sent.",
};

type EmailEditorProps = {
  campaignId: string;
  email: OutboundEmail;
  disabled: boolean;
  track: (save: Promise<unknown>) => void;
};

function EmailEditor({ campaignId, email, disabled, track }: EmailEditorProps) {
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [error, setError] = useState<string | null>(null);

  function save(patch: { subject?: string; body?: string }) {
    setError(null);
    track(
      api(`/campaigns/${campaignId}/emails/${email.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).catch((cause) => setError(errorMessage(cause))),
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${email.id}-subject`} className="block text-sm font-medium">
          Subject
        </label>
        <input
          id={`${email.id}-subject`}
          value={subject}
          disabled={disabled}
          onChange={(event) => setSubject(event.target.value)}
          onBlur={() => subject !== email.subject && save({ subject })}
          className={fieldClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${email.id}-body`} className="block text-sm font-medium">
          Email
        </label>
        <textarea
          id={`${email.id}-body`}
          value={body}
          disabled={disabled}
          rows={9}
          onChange={(event) => setBody(event.target.value)}
          onBlur={() => body !== email.body && save({ body })}
          className={`${fieldClass} resize-y`}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}

type CampaignDraftsCardProps = {
  campaignId: string;
  action: PendingAction | null;
  refreshKey: number;
  onChanged: () => void;
};

export function CampaignDraftsCard({
  campaignId,
  action,
  refreshKey,
  onChanged,
}: CampaignDraftsCardProps) {
  const { campaign, error } = useCampaign(campaignId, refreshKey);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const saves = useRef<Promise<unknown>>(Promise.resolve());

  if (!campaign) {
    return (
      <div className="rounded-xl border border-line p-4 text-sm text-muted">
        {error ?? "Loading drafts…"}
      </div>
    );
  }

  const total = campaign.steps.length * campaign.recipients.length;

  if (campaign.status === "DRAFTING") {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-xl border border-line p-4 text-sm"
      >
        <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
        Writing drafts, {campaign.emails.length} of {total} done
      </div>
    );
  }

  if (campaign.emails.length === 0) {
    return (
      <p className="rounded-xl border border-line p-4 text-sm text-muted">
        {STATUS_NOTES[campaign.status]}
      </p>
    );
  }

  const selectedCandidate = candidateId ?? campaign.recipients[0].candidate.id;
  const selectedStep = stepId ?? campaign.steps[0].id;
  const email = campaign.emails.find(
    (item) =>
      item.candidateId === selectedCandidate &&
      item.campaignStepId === selectedStep,
  );

  return (
    <div className="rounded-xl border border-line">
      <div className="grid md:grid-cols-[13rem_1fr]">
        <ul className="flex gap-1 overflow-x-auto border-b border-line p-2 md:block md:space-y-1 md:border-r md:border-b-0">
          {campaign.recipients.map(({ candidate }) => (
            <li key={candidate.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={candidate.id === selectedCandidate}
                onClick={() => setCandidateId(candidate.id)}
                className={`w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-brand ${
                  candidate.id === selectedCandidate
                    ? "bg-brand-soft font-medium text-brand-strong"
                    : "text-muted hover:bg-canvas"
                }`}
              >
                {candidate.name ?? candidate.email}
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 space-y-3 p-4">
          {campaign.steps.length > 1 && (
            <div role="group" aria-label="Email in the sequence" className="flex flex-wrap gap-1">
              {campaign.steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  aria-pressed={step.id === selectedStep}
                  onClick={() => setStepId(step.id)}
                  className={`rounded-md px-2.5 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${
                    step.id === selectedStep
                      ? "bg-brand-soft text-brand-strong"
                      : "text-muted hover:bg-canvas"
                  }`}
                >
                  Day {step.dayOffset}
                </button>
              ))}
            </div>
          )}

          {email && (
            <EmailEditor
              key={email.id}
              campaignId={campaignId}
              email={email}
              disabled={campaign.status !== "DRAFT"}
              track={(save) => {
                saves.current = Promise.all([saves.current, save]);
              }}
            />
          )}
        </div>
      </div>

      <div className="border-t border-line p-4">
        {action?.status === "PENDING" ? (
          <ActionButtons
            actionId={action.id}
            confirmLabel={`Approve and send ${campaign.emails.length} emails`}
            cancelLabel="Discard"
            beforeConfirm={async () => {
              await saves.current;
            }}
            onChanged={onChanged}
          />
        ) : (
          <p className="text-sm text-muted">{STATUS_NOTES[campaign.status]}</p>
        )}
      </div>
    </div>
  );
}
