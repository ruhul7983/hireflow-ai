"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";

const buttonBase =
  "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60";

export const primaryButton = `${buttonBase} bg-brand text-white hover:bg-brand-strong`;
export const secondaryButton = `${buttonBase} border border-line text-ink hover:bg-canvas`;

type ActionButtonsProps = {
  actionId: string;
  confirmLabel: string;
  cancelLabel?: string;
  disabled?: boolean;
  beforeConfirm?: () => Promise<void>;
  onChanged: () => void;
};

export function ActionButtons({
  actionId,
  confirmLabel,
  cancelLabel = "Cancel",
  disabled = false,
  beforeConfirm,
  onChanged,
}: ActionButtonsProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(verb: "confirm" | "cancel") {
    setPending(true);
    setError(null);
    try {
      if (verb === "confirm") await beforeConfirm?.();
      await api(`/chat/actions/${actionId}/${verb}`, { method: "POST" });
      onChanged();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => resolve("confirm")}
          disabled={pending || disabled}
          className={primaryButton}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => resolve("cancel")}
          disabled={pending}
          className={secondaryButton}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
