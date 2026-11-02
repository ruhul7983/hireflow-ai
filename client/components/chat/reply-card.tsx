"use client";

import { useRef, useState } from "react";
import { CircleAlert, ExternalLink, LoaderCircle } from "lucide-react";
import { ActionButtons } from "@/components/chat/action-buttons";
import { MeetingTimeField } from "@/components/chat/meeting-time-field";
import { api, errorMessage } from "@/lib/api";
import type {
  CandidateReply,
  PendingAction,
  ReplyClassification,
} from "@/lib/chat-types";

const CLASSIFICATIONS: Record<
  ReplyClassification,
  { label: string; tone: string }
> = {
  INTERESTED: {
    label: "Interested",
    tone: "bg-success-soft text-success-strong",
  },
  WANTS_MEETING: {
    label: "Wants a meeting",
    tone: "bg-brand-soft text-brand-strong",
  },
  QUESTION: {
    label: "Question",
    tone: "bg-warning-soft text-warning-strong",
  },
  NOT_INTERESTED: { label: "Not interested", tone: "bg-canvas text-muted" },
  UNSUBSCRIBE: {
    label: "Unsubscribe",
    tone: "bg-danger-soft text-danger-strong",
  },
};

const DRAFT_NOTES: Partial<Record<NonNullable<CandidateReply["draftStatus"]>, string>> = {
  APPROVED: "Approved. Sending now.",
  SENDING: "Approved. Sending now.",
  SENT: "Sent.",
  FAILED: "This reply could not be sent.",
  DISCARDED: "Discarded. Nothing was sent.",
};

type ReplyDraftProps = {
  reply: CandidateReply;
  action: PendingAction | null;
  onChanged: () => void;
};

function ReplyDraft({ reply, action, onChanged }: ReplyDraftProps) {
  const [draft, setDraft] = useState(reply.draftBody ?? "");
  const [error, setError] = useState<string | null>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const timeFailure = useRef<unknown>(null);

  const isOpen =
    reply.draftStatus === "PENDING_APPROVAL" && action?.status === "PENDING";
  const canSetTime =
    isOpen &&
    (reply.meeting?.status === "DRAFTED" ||
      reply.meeting?.status === "LINK_SENT");

  function saveTime(startsAt: string | null) {
    setError(null);
    timeFailure.current = null;
    saving.current = api<{ draftBody: string }>(
      `/replies/${reply.id}/meeting-time`,
      {
        method: "PATCH",
        body: JSON.stringify({
          startsAt,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      },
    )
      .then(({ draftBody }) => setDraft(draftBody))
      .catch((cause) => {
        timeFailure.current = cause;
        setError(errorMessage(cause));
      });
  }

  function save() {
    if (draft === reply.draftBody) return;

    setError(null);
    saving.current = api(`/replies/${reply.id}/draft`, {
      method: "PATCH",
      body: JSON.stringify({ draftBody: draft }),
    }).catch((cause) => setError(errorMessage(cause)));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${reply.id}-draft`} className="block text-sm font-medium">
          Your reply
        </label>
        <textarea
          id={`${reply.id}-draft`}
          value={draft}
          disabled={!isOpen}
          rows={6}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          className="w-full resize-y rounded-lg border border-muted/70 bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand/20 disabled:bg-canvas disabled:text-muted"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}

      {canSetTime && reply.meeting && (
        <MeetingTimeField
          id={`${reply.id}-time`}
          startsAt={reply.meeting.startsAt}
          onChange={saveTime}
        />
      )}

      {reply.meeting && !canSetTime && reply.meeting.status !== "BOOKED" && (
        <p className="text-sm text-muted">
          {reply.meeting.status === "DRAFTED" ? (
            "A private booking link is added below your message when it's sent."
          ) : (
            <a
              href={`/book/${reply.meeting.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-strong hover:underline"
            >
              Open the candidate&apos;s booking page
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </p>
      )}

      {isOpen && action ? (
        <ActionButtons
          actionId={action.id}
          confirmLabel="Approve and send"
          cancelLabel="Discard"
          disabled={!draft.trim()}
          beforeConfirm={async () => {
            await saving.current;
            // Sending would otherwise promise a time that was never saved
            if (timeFailure.current) throw timeFailure.current;
          }}
          onChanged={onChanged}
        />
      ) : (
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
          {reply.autoSent && reply.draftStatus === "SENT"
            ? "Sent automatically, because auto-reply is on for this job."
            : reply.draftStatus && DRAFT_NOTES[reply.draftStatus]}
          {reply.previewUrl && (
            <a
              href={reply.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-strong hover:underline"
            >
              Open
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </p>
      )}
    </div>
  );
}

type ReplyCardProps = {
  reply: CandidateReply;
  action: PendingAction | null;
  onChanged: () => void;
};

export function ReplyCard({ reply, action, onChanged }: ReplyCardProps) {
  const { candidate, classification, body, error } = reply;
  const details = classification && CLASSIFICATIONS[classification];

  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold">
          {candidate.name ?? candidate.email}
        </p>
        {details && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${details.tone}`}
          >
            {details.label}
          </span>
        )}
      </div>

      <blockquote className="rounded-lg bg-canvas px-3 py-2 text-sm break-words whitespace-pre-wrap">
        {body}
      </blockquote>

      {!classification && !error && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
          Reading this reply
        </p>
      )}

      {error && (
        <p className="flex items-start gap-2 text-sm font-medium text-danger-strong">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {reply.draftBody && (
        <ReplyDraft
          key={reply.draftStatus}
          reply={reply}
          action={action}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
