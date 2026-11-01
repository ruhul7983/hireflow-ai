"use client";

import { useState } from "react";
import { useList } from "@/components/list/list-context";
import { api, errorMessage } from "@/lib/api";
import type { JobRow } from "@/lib/list-types";

const TURN_ON_WARNING =
  "Turn on auto-reply for this job?\n\nThe AI will answer simple replies without asking you first. It never answers questions, and anything with a link, a figure or a price still waits for you. It replies once per candidate, and up to 20 times a day.";

export function AutoReplyToggle({ job }: { job: JobRow }) {
  const { pending, refresh } = useList();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(enabled: boolean) {
    if (enabled && !window.confirm(TURN_ON_WARNING)) return;

    setSaving(true);
    setError(null);
    try {
      await api(`/jobs/${job.id}/auto-reply`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
    setSaving(false);
  }

  return (
    <>
      <label className="flex items-center gap-2 whitespace-nowrap">
        <input
          type="checkbox"
          role="switch"
          checked={job.autoReply}
          disabled={saving || pending}
          onChange={(event) => toggle(event.target.checked)}
          aria-label={`Auto-reply for ${job.title}`}
          className="size-4 accent-brand disabled:opacity-60"
        />
        <span className="text-muted">{job.autoReply ? "On" : "Off"}</span>
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger-strong">
          {error}
        </p>
      )}
    </>
  );
}
