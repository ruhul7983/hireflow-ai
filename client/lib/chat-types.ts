export type ConversationSummary = {
  id: string;
  title: string;
  jobId: string | null;
  updatedAt: string;
};

export type RemotePolicy = "ONSITE" | "HYBRID" | "REMOTE";

export type JobFields = {
  title: string | null;
  seniority: string | null;
  location: string | null;
  salary: string | null;
  remotePolicy: RemotePolicy | null;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
};

export type JobDraft = JobFields & { id: string };
export type Job = JobFields & { id: string; title: string };

export type RunStatus =
  | "QUEUED"
  | "SOURCING"
  | "SCORING"
  | "COMPLETED"
  | "FAILED";

export type SourcingRun = {
  id: string;
  jobId: string;
  source: "SERPER" | "CSV";
  status: RunStatus;
  fileName: string | null;
  foundCount: number;
  duplicateCount: number;
  skippedCount: number;
  scoredCount: number;
  error: string | null;
};

export type PendingAction = {
  id: string;
  status: "PENDING" | "EXECUTED" | "CANCELLED" | "FAILED";
  decision: "ACCEPTED" | "REJECTED" | null;
  jobId: string | null;
  candidates: {
    candidate: {
      id: string;
      name: string | null;
      headline: string | null;
      score: number | null;
    };
  }[];
};

export type CardType =
  | "JOB_DRAFT"
  | "JOB_CREATED"
  | "SOURCING_PROMPT"
  | "SOURCING_PROGRESS"
  | "CANDIDATE_TABLE"
  | "CANDIDATE_DECISION";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  cardType: CardType | null;
  jobId: string | null;
  jobDraft: JobDraft | null;
  job: Job | null;
  sourcingRun: SourcingRun | null;
  pendingAction: PendingAction | null;
};

export type Conversation = ConversationSummary & { messages: ChatMessage[] };

export type CandidateStatus = "SOURCED" | "ACCEPTED" | "REJECTED";

export type Candidate = {
  id: string;
  name: string | null;
  email: string | null;
  profileUrl: string | null;
  headline: string | null;
  location: string | null;
  score: number | null;
  scoreReason: string | null;
  // Later pipeline stages arrive with outreach, so review treats them as decided
  status: CandidateStatus | string;
};

export type ChatEvent =
  | { type: "changed" }
  | { type: "ping" }
  | { type: "run"; run: SourcingRun };
