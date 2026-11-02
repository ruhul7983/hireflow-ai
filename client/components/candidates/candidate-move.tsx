"use client";

import { useState } from "react";
import { useList } from "@/components/list/list-context";
import { api, errorMessage } from "@/lib/api";
import { statusLabel } from "@/lib/candidate-status";
import type { CandidateRow } from "@/lib/list-types";

// Using the control is the recruiter's confirmation, the same as the chat table
export function CandidateMove({
  candidate,
}: {
  candidate: Pick<CandidateRow, "id" | "name" | "nextStatuses" | "job">;
}) {
  const { pending, refresh } = useList();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(status: string) {
    setSaving(true);
    setError(null);
    try {
      await api(`/jobs/${candidate.job.id}/candidates/${candidate.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
    setSaving(false);
  }

  if (candidate.nextStatuses.length === 0) {
    return <span className="text-xs text-muted">No further moves</span>;
  }

  return (
    <>
      <select
        value=""
        disabled={saving || pending}
        aria-label={`Move ${candidate.name ?? "candidate"} to another stage`}
        onChange={(event) => move(event.target.value)}
        className="max-w-36 rounded-md border border-muted/70 bg-surface px-1.5 py-1 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
      >
        <option value="">Move to…</option>
        {candidate.nextStatuses.map((status) => (
          <option key={status} value={status}>
            {statusLabel(status)}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger-strong">
          {error}
        </p>
      )}
    </>
  );
}
