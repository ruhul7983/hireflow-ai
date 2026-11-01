"use client";

import { useEffect, useRef, useState } from "react";
import {
  primaryButton,
  secondaryButton,
} from "@/components/chat/action-buttons";
import { api, errorMessage } from "@/lib/api";

const SAMPLE_REPLIES = [
  {
    label: "Interested",
    text: "Thanks for reaching out. This sounds interesting and I'd like to hear more.",
  },
  {
    label: "Wants a meeting",
    text: "Happy to talk. Could we set up a call this week?",
  },
  {
    label: "Question",
    text: "What is the salary range, and how many days a week are in the office?",
  },
  {
    label: "Not interested",
    text: "Thanks, but I'm not looking for a new role right now.",
  },
  {
    label: "Unsubscribe",
    text: "Please remove me from your list and don't contact me again.",
  },
];

type ReplyDialogProps = {
  candidateId: string;
  candidateName: string;
  onClose: () => void;
  onSent: () => void;
};

function ReplyDialog({
  candidateId,
  candidateName,
  onClose,
  onSent,
}: ReplyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function handleSend() {
    setPending(true);
    setError(null);
    try {
      await api("/simulate-reply", {
        method: "POST",
        body: JSON.stringify({ candidateId, body }),
      });
      onSent();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="reply-dialog-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="space-y-4 p-5">
        <div>
          <h2 id="reply-dialog-title" className="text-lg font-semibold tracking-tight">
            Simulate a reply
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Write what {candidateName} replied, or start from a sample.
          </p>
        </div>

        <div role="group" aria-label="Sample replies" className="flex flex-wrap gap-1.5">
          {SAMPLE_REPLIES.map(({ label, text }) => (
            <button
              key={label}
              type="button"
              onClick={() => setBody(text)}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          aria-label="Reply text"
          className="w-full resize-y rounded-lg border border-muted/70 bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand/20"
        />

        {error && (
          <p role="alert" className="text-sm font-medium text-danger-strong">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
            className={secondaryButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={pending || !body.trim()}
            className={primaryButton}
          >
            {pending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

type SimulateReplyButtonProps = {
  candidateId: string;
  candidateName: string;
  onChanged: () => void;
};

export function SimulateReplyButton({
  candidateId,
  candidateName,
  onChanged,
}: SimulateReplyButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Simulate a reply from ${candidateName}`}
        className="text-sm font-medium whitespace-nowrap text-brand-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
      >
        Simulate reply
      </button>
      {open && (
        <ReplyDialog
          candidateId={candidateId}
          candidateName={candidateName}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}
