"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import {
  primaryButton,
  secondaryButton,
} from "@/components/chat/action-buttons";
import { api, errorMessage } from "@/lib/api";
import type { CsvField, CsvPreview } from "@/lib/chat-types";

const FIELDS: { key: CsvField; label: string; hint?: string }[] = [
  { key: "name", label: "Name", hint: "Or first name" },
  { key: "lastName", label: "Last name", hint: "Only if it's a separate column" },
  { key: "email", label: "Email" },
  { key: "profileUrl", label: "Profile URL" },
  { key: "headline", label: "Job title" },
  { key: "location", label: "Location" },
];

const selectClass =
  "w-full min-w-0 rounded-lg border border-muted/70 bg-surface px-2.5 py-2 text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand/20";

type Matches = Partial<Record<CsvField, number>>;

type CsvColumnDialogProps = {
  file: File;
  preview: CsvPreview;
  jobId: string;
  conversationId: string;
  onClose: () => void;
  onImported: () => void;
};

export function CsvColumnDialog({
  file,
  preview,
  jobId,
  conversationId,
  onClose,
  onImported,
}: CsvColumnDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { detailColumns: suggestedDetails, ...suggestedMatches } =
    preview.suggestion;

  const [matches, setMatches] = useState<Matches>(suggestedMatches);
  const [details, setDetails] = useState(suggestedDetails);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const hasIdentifier =
    matches.email !== undefined || matches.profileUrl !== undefined;
  const matchedColumns = Object.values(matches);
  const spareColumns = preview.columns.filter(
    ({ index }) => !matchedColumns.includes(index),
  );

  function chooseColumn(field: CsvField, value: string) {
    const index = value === "" ? undefined : Number(value);

    // One column can only fill one field, so choosing it moves it here
    setMatches((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([, column]) => column !== index),
      ) as Matches;
      return { ...next, [field]: index };
    });
    setDetails((current) => current.filter((column) => column !== index));
  }

  function toggleDetail(index: number) {
    setDetails((current) =>
      current.includes(index)
        ? current.filter((column) => column !== index)
        : [...current, index],
    );
  }

  async function handleImport() {
    const form = new FormData();
    form.append("conversationId", conversationId);
    form.append("file", file);

    for (const { key } of FIELDS) {
      const column = matches[key];
      if (column !== undefined) form.append(`${key}Column`, String(column));
    }
    if (details.length > 0) form.append("detailColumns", details.join(","));

    setPending(true);
    setError(null);
    try {
      await api(`/jobs/${jobId}/candidates/csv`, { method: "POST", body: form });
      onImported();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="csv-dialog-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="space-y-5 p-5">
        <div>
          <h2 id="csv-dialog-title" className="text-lg font-semibold tracking-tight">
            Match your columns
          </h2>
          <p className="mt-0.5 text-sm break-words text-muted">
            {file.name} has {preview.rowCount}{" "}
            {preview.rowCount === 1 ? "row" : "rows"}. Check each match before
            importing.
          </p>
        </div>

        <table className="w-full table-fixed text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="w-2/5 pb-2 font-medium sm:w-40">
                Field
              </th>
              <th scope="col" className="pb-2 font-medium sm:w-56">
                Your column
              </th>
              <th scope="col" className="hidden pb-2 pl-4 font-medium sm:table-cell">
                Example
              </th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map(({ key, label, hint }) => {
              const example =
                preview.columns.find(({ index }) => index === matches[key])
                  ?.samples[0] ?? "—";

              return (
                <tr key={key} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left align-top font-medium">
                    {label}
                    {hint && (
                      <span className="block text-xs font-normal text-muted">
                        {hint}
                      </span>
                    )}
                  </th>
                  <td className="py-2.5 align-top">
                    <select
                      value={matches[key] ?? ""}
                      aria-label={`Column for ${label}`}
                      onChange={(event) => chooseColumn(key, event.target.value)}
                      className={selectClass}
                    >
                      <option value="">Don&apos;t import</option>
                      {preview.columns.map(({ index, name }) => (
                        <option key={index} value={index}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block truncate text-xs text-muted sm:hidden">
                      {example}
                    </span>
                  </td>
                  <td className="hidden truncate py-2.5 pl-4 align-top text-muted sm:table-cell">
                    {example}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {spareColumns.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Other columns the AI can use for scoring
            </legend>
            <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {spareColumns.map(({ index, name, samples }) => (
                <label key={index} className="flex min-w-0 items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={details.includes(index)}
                    onChange={() => toggleDetail(index)}
                    className="mt-0.5 size-4 shrink-0 accent-brand"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="block truncate text-xs text-muted">
                      {samples[0] ?? "Empty"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {!hasIdentifier && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-strong"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Match Email or Profile URL, so each candidate can be told apart.
          </p>
        )}
        {hasIdentifier && matches.email === undefined && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-strong"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Without an email column, these candidates can&apos;t be contacted.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger-strong">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
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
            onClick={handleImport}
            disabled={pending || !hasIdentifier}
            className={primaryButton}
          >
            {pending
              ? "Importing…"
              : `Import ${preview.rowCount} ${preview.rowCount === 1 ? "row" : "rows"}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
