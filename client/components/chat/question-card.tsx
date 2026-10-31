"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { AgentQuestion } from "@/lib/chat-types";

type QuestionCardProps = {
  question: AgentQuestion;
  onChanged: () => void;
};

export function QuestionCard({ question, onChanged }: QuestionCardProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The answer already appears as the recruiter's own message
  if (question.status === "ANSWERED") return null;

  if (question.status === "CANCELLED") {
    return <p className="text-sm text-muted">Cancelled</p>;
  }

  async function submit(path: string, body: string | undefined, id: string) {
    setPendingId(id);
    setError(null);
    try {
      await api(`/chat/questions/${question.id}/${path}`, {
        method: "POST",
        body,
      });
      onChanged();
    } catch (cause) {
      setError(errorMessage(cause));
      setPendingId(null);
    }
  }

  const busy = pendingId !== null;

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Suggested answers" className="flex flex-wrap gap-2">
        {question.options.map(({ id, label, description, recommended }) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            aria-label={recommended ? `${label}, suggested` : label}
            onClick={() =>
              submit("answer", JSON.stringify({ optionId: id }), id)
            }
            className={`rounded-lg border px-3.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 ${
              recommended
                ? "border-brand bg-brand-soft text-brand-strong hover:bg-brand hover:text-white"
                : "border-line hover:bg-canvas"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              {pendingId === id ? "Working…" : label}
              {recommended && pendingId !== id && (
                <span className="rounded bg-brand px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">
                  Suggested
                </span>
              )}
            </span>
            {description && (
              <span className="block text-xs font-normal opacity-80">
                {description}
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => submit("cancel", undefined, "cancel")}
        className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-60"
      >
        Cancel setup
      </button>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}
