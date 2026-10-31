"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { secondaryButton } from "@/components/chat/action-buttons";
import { api, errorMessage } from "@/lib/api";

type CsvUploadButtonProps = {
  jobId: string;
  conversationId: string;
  onChanged: () => void;
};

export function CsvUploadButton({
  jobId,
  conversationId,
  onChanged,
}: CsvUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const form = new FormData();
    form.append("conversationId", conversationId);
    form.append("file", file);

    setPending(true);
    setError(null);
    try {
      await api(`/jobs/${jobId}/candidates/csv`, { method: "POST", body: form });
      onChanged();
    } catch (cause) {
      setError(errorMessage(cause));
    }
    setPending(false);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        aria-label="Upload a CSV of candidates"
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className={`${secondaryButton} flex items-center gap-2`}
      >
        <Upload className="size-4" aria-hidden />
        {pending ? "Uploading…" : "Upload CSV"}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}
    </>
  );
}
