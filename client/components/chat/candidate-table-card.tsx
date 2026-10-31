"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { CsvUploadButton } from "@/components/chat/csv-upload-button";
import { api, errorMessage } from "@/lib/api";
import type { Candidate } from "@/lib/chat-types";

const FILTERS = [
  { key: "SOURCED", label: "To review" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

function scoreTone(score: number) {
  if (score >= 70) return "bg-success-soft text-success-strong";
  if (score >= 40) return "bg-warning-soft text-warning-strong";
  return "bg-canvas text-muted";
}

function matches(candidate: Candidate, filter: Filter) {
  return filter === "ALL" || candidate.status === filter;
}

type CandidateTableCardProps = {
  jobId: string;
  conversationId: string;
  refreshKey: number;
  onChanged: () => void;
};

export function CandidateTableCard({
  jobId,
  conversationId,
  refreshKey,
  onChanged,
}: CandidateTableCardProps) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [filter, setFilter] = useState<Filter>("SOURCED");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api<Candidate[]>(`/jobs/${jobId}/candidates`)
      .then((rows) => {
        if (active) setCandidates(rows);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [jobId, refreshKey]);

  async function decide(candidateId: string, decision: "ACCEPTED" | "REJECTED") {
    setBusyId(candidateId);
    setError(null);
    try {
      await api(`/jobs/${jobId}/candidates/${candidateId}/decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      setCandidates((rows) =>
        (rows ?? []).map((row) =>
          row.id === candidateId ? { ...row, status: decision } : row,
        ),
      );
      onChanged();
    } catch (cause) {
      setError(errorMessage(cause));
    }
    setBusyId(null);
  }

  if (!candidates) {
    return (
      <div className="rounded-xl border border-line p-4 text-sm text-muted">
        {error ?? "Loading candidates…"}
      </div>
    );
  }

  const visible = candidates.filter((candidate) => matches(candidate, filter));

  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
        <div role="group" aria-label="Filter candidates" className="flex flex-wrap gap-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-2.5 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${
                filter === key
                  ? "bg-brand-soft text-brand-strong"
                  : "text-muted hover:bg-canvas"
              }`}
            >
              {label}{" "}
              <span className="tabular-nums">
                {candidates.filter((candidate) => matches(candidate, key)).length}
              </span>
            </button>
          ))}
        </div>
        <CsvUploadButton
          jobId={jobId}
          conversationId={conversationId}
          onChanged={onChanged}
        />
      </div>

      {error && (
        <p role="alert" className="px-4 pt-3 text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="p-4 text-sm text-muted">No candidates here yet.</p>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead className="sticky top-0 bg-surface text-left text-muted shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Score</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Candidate</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Why</th>
                <th scope="col" className="py-2.5 pr-4 font-medium">Email</th>
                <th scope="col" className="py-2.5 pr-4 text-right font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((candidate) => (
                <tr key={candidate.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    {candidate.score === null ? (
                      <span className="text-xs text-muted">Scoring…</span>
                    ) : (
                      <span
                        className={`inline-block min-w-9 rounded-md px-1.5 py-0.5 text-center font-semibold tabular-nums ${scoreTone(candidate.score)}`}
                      >
                        {candidate.score}
                      </span>
                    )}
                  </td>
                  <th scope="row" className="max-w-52 py-3 pr-4 text-left font-medium">
                    {candidate.profileUrl ? (
                      <a
                        href={candidate.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                      >
                        {candidate.name ?? "View profile"}
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                      </a>
                    ) : (
                      (candidate.name ?? "Name not shown")
                    )}
                    {candidate.headline && (
                      <span className="mt-0.5 line-clamp-2 text-xs font-normal text-muted">
                        {candidate.headline}
                      </span>
                    )}
                  </th>
                  <td className="py-3 pr-4 text-muted">
                    {candidate.scoreReason ?? "Not scored yet"}
                  </td>
                  <td className="max-w-40 truncate py-3 pr-4">
                    {candidate.email ?? <span className="text-muted">Not known</span>}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => decide(candidate.id, "ACCEPTED")}
                        disabled={busyId === candidate.id || candidate.status === "ACCEPTED"}
                        aria-label={`Accept ${candidate.name ?? "candidate"}`}
                        className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-success-strong hover:bg-success-soft focus-visible:outline-2 focus-visible:outline-brand disabled:border-transparent disabled:bg-success-soft"
                      >
                        {candidate.status === "ACCEPTED" ? "Accepted" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(candidate.id, "REJECTED")}
                        disabled={busyId === candidate.id || candidate.status === "REJECTED"}
                        aria-label={`Reject ${candidate.name ?? "candidate"}`}
                        className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-danger-strong hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-brand disabled:border-transparent disabled:bg-danger-soft"
                      >
                        {candidate.status === "REJECTED" ? "Rejected" : "Reject"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
