export type WeekCounts = {
  weekStart: string;
  sourced: number;
  contacted: number;
  replied: number;
  interested: number;
  meetings: number;
  hired: number;
};

export type WeeklyMetric = Exclude<keyof WeekCounts, "weekStart">;

export type FunnelStage = { key: string; label: string; count: number };

export type ReplyOutcome = {
  classification:
    | "WANTS_MEETING"
    | "INTERESTED"
    | "QUESTION"
    | "NOT_INTERESTED"
    | "UNSUBSCRIBE";
  count: number;
};

export type Approval = {
  id: string;
  kind: "reply" | "campaign" | "job" | "candidates";
  title: string;
  job: string;
  conversationId: string;
};

export type ActivityItem = {
  id: string;
  actor: "RECRUITER" | "AI" | "SYSTEM";
  summary: string;
  createdAt: string;
  job: { title: string };
};

export type DashboardJob = {
  id: string;
  title: string;
  location: string | null;
  remotePolicy: "ONSITE" | "HYBRID" | "REMOTE" | null;
  conversationId: string | null;
  phase: "Sourcing" | "Outreach" | "Interviewing" | "Hired";
  replyRate: number | null;
  interestedRate: number | null;
  funnel: {
    sourced: number;
    meetings: number;
    hired: number;
  };
};

export type Dashboard = {
  summary: {
    openJobs: number;
    sourced: number;
    replyRate: number | null;
    interestedRate: number | null;
    meetings: number;
    hires: number;
  };
  stages: FunnelStage[];
  exits: { rejected: number; notInterested: number; unsubscribed: number };
  weeks: WeekCounts[];
  replyOutcomes: ReplyOutcome[];
  approvals: Approval[];
  activity: ActivityItem[];
  jobs: DashboardJob[];
};
