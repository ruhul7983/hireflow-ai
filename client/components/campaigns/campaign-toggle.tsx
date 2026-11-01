"use client";

import { useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { secondaryButton } from "@/components/chat/action-buttons";
import { useList } from "@/components/list/list-context";
import { api, errorMessage } from "@/lib/api";
import type { CampaignRow } from "@/lib/list-types";

export function CampaignToggle({ campaign }: { campaign: CampaignRow }) {
  const { pending, refresh } = useList();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSending = campaign.status === "SENDING";

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      await api(`/campaigns/${campaign.id}/${isSending ? "pause" : "resume"}`, {
        method: "POST",
      });
      refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
    setSaving(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={saving || pending}
        aria-label={`${isSending ? "Pause" : "Resume"} ${campaign.name}`}
        className={`${secondaryButton} flex items-center gap-2`}
      >
        {isSending ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Play className="size-4" aria-hidden />
        )}
        {isSending ? "Pause" : "Resume"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger-strong">
          {error}
        </p>
      )}
    </>
  );
}

export function CampaignStop({ campaign }: { campaign: CampaignRow }) {
  const { pending, refresh } = useList();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stop() {
    const confirmed = window.confirm(
      `Stop ${campaign.name} for good? Emails not sent yet are cancelled, and its candidates can join a new campaign.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      await api(`/campaigns/${campaign.id}/stop`, { method: "POST" });
      refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
    setSaving(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={stop}
        disabled={saving || pending}
        aria-label={`Stop ${campaign.name}`}
        className={`${secondaryButton} flex items-center gap-2`}
      >
        <Square className="size-4" aria-hidden />
        Stop
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger-strong">
          {error}
        </p>
      )}
    </>
  );
}
