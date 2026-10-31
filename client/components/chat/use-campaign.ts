"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Campaign } from "@/lib/chat-types";

export function useCampaign(campaignId: string, refreshKey: number) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api<Campaign>(`/campaigns/${campaignId}`)
      .then((loaded) => {
        if (active) setCampaign(loaded);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [campaignId, refreshKey]);

  return { campaign, error };
}
