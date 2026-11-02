"use client";

import { useState } from "react";
import { X } from "lucide-react";

const MINUTE_MS = 60_000;

// The browser's date and time input works in local time, without a timezone
function toInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * MINUTE_MS);
  return local.toISOString().slice(0, 16);
}

type MeetingTimeFieldProps = {
  id: string;
  startsAt: string | null;
  onChange: (startsAt: string | null) => void;
};

export function MeetingTimeField({
  id,
  startsAt,
  onChange,
}: MeetingTimeFieldProps) {
  const [value, setValue] = useState(() =>
    startsAt ? toInputValue(new Date(startsAt)) : "",
  );
  const [saved, setSaved] = useState(value);
  const [earliest] = useState(() => toInputValue(new Date()));

  // On leaving the field, so half-typed dates never reach the server
  function commit(next: string) {
    if (next === saved) return;

    setSaved(next);
    onChange(next ? new Date(next).toISOString() : null);
  }

  function clear() {
    setValue("");
    commit("");
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        Meeting date and time
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="datetime-local"
          value={value}
          min={earliest}
          onChange={(event) => setValue(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          className="min-w-0 rounded-lg border border-muted/70 bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand/20"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear the meeting time"
            className="rounded-md p-1.5 text-muted hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        {saved
          ? "A calendar invite is attached to your email when it's sent."
          : "Pick any future time, or leave this empty to send a booking link instead."}
      </p>
    </div>
  );
}
