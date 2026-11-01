import type { Campaign } from "@/lib/chat-types";
import type { DashboardJob } from "@/lib/dashboard-types";

export type JobOption = { id: string; title: string };

export type JobRow = DashboardJob & {
  seniority: string | null;
  autoReply: boolean;
  createdAt: string;
  campaigns: number;
  usage: { tokens: number; costUsd: number };
};

export type CandidateRow = {
  id: string;
  name: string | null;
  email: string | null;
  profileUrl: string | null;
  headline: string | null;
  location: string | null;
  score: number | null;
  scoreReason: string | null;
  status: string;
  nextStatuses: string[];
  job: JobOption;
};

export type CampaignRow = {
  id: string;
  name: string;
  status: Campaign["status"];
  dailyLimit: number;
  conversationId: string;
  createdAt: string;
  job: JobOption;
  recipients: number;
  emails: { total: number; sent: number; failed: number; stopped: number };
};
