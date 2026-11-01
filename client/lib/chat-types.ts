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
  decision: string | null;
  jobId: string | null;
  campaignName: string | null;
  campaignChange: "PAUSE" | "RESUME" | "STOP" | null;
  dayOffsets: number[];
  dailyLimit: number | null;
  instructions: string | null;
  candidates: {
    candidate: {
      id: string;
      name: string | null;
      headline: string | null;
      email: string | null;
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
  | "CANDIDATE_DECISION"
  | "CAMPAIGN_PROPOSAL"
  | "CAMPAIGN_DRAFTS"
  | "CAMPAIGN_PROGRESS"
  | "CAMPAIGN_CHANGE"
  | "QUESTION"
  | "CANDIDATE_REPLY"
  | "MEETING_BOOKED";

export type AgentQuestion = {
  id: string;
  status: "PENDING" | "ANSWERED" | "CANCELLED";
  answerLabel: string | null;
  options: {
    id: string;
    label: string;
    description: string | null;
    recommended: boolean;
  }[];
};

type MeetingStatus =
  | "DRAFTED"
  | "LINK_SENT"
  | "BOOKED"
  | "COMPLETED"
  | "CANCELLED";

export type MeetingSummary = {
  status: MeetingStatus;
  startsAt: string | null;
  candidate: { name: string | null; email: string | null };
};

export type PublicMeeting = {
  status: MeetingStatus;
  startsAt: string | null;
  firstName: string | null;
  jobTitle: string;
  hostName: string;
  slots: string[];
};

export type ReplyClassification =
  | "INTERESTED"
  | "WANTS_MEETING"
  | "QUESTION"
  | "NOT_INTERESTED"
  | "UNSUBSCRIBE";

export type CandidateReply = {
  id: string;
  body: string;
  classification: ReplyClassification | null;
  draftBody: string | null;
  draftStatus:
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "SENDING"
    | "SENT"
    | "FAILED"
    | "DISCARDED"
    | null;
  autoSent: boolean;
  previewUrl: string | null;
  error: string | null;
  candidate: { id: string; name: string | null; email: string | null };
  meeting: { status: MeetingStatus; token: string } | null;
};

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  cardType: CardType | null;
  jobId: string | null;
  campaignId: string | null;
  jobDraft: JobDraft | null;
  job: Job | null;
  sourcingRun: SourcingRun | null;
  pendingAction: PendingAction | null;
  question: AgentQuestion | null;
  reply: CandidateReply | null;
  meeting: MeetingSummary | null;
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
  nextStatuses: string[];
};

export type ActivityEntry = {
  id: string;
  actor: "RECRUITER" | "AI" | "SYSTEM";
  summary: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
  job: { title: string };
};

export type OutboundEmail = {
  id: string;
  campaignStepId: string;
  candidateId: string;
  subject: string;
  body: string;
  status: "DRAFT" | "APPROVED" | "SENDING" | "SENT" | "FAILED" | "STOPPED";
  dueAt: string | null;
  sentAt: string | null;
  previewUrl: string | null;
  error: string | null;
};

export type Campaign = {
  id: string;
  name: string;
  status:
    | "DRAFTING"
    | "DRAFT"
    | "SENDING"
    | "PAUSED"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED";
  dailyLimit: number;
  steps: { id: string; position: number; dayOffset: number }[];
  recipients: {
    stoppedAt: string | null;
    candidate: {
      id: string;
      name: string | null;
      email: string | null;
      status: string;
    };
  }[];
  emails: OutboundEmail[];
};

export type CsvField =
  | "name"
  | "lastName"
  | "email"
  | "profileUrl"
  | "headline"
  | "location";

export type CsvPreview = {
  rowCount: number;
  columns: { index: number; name: string; samples: string[] }[];
  suggestion: Partial<Record<CsvField, number>> & { detailColumns: number[] };
};

export type ChatEvent =
  | { type: "changed" }
  | { type: "ping" }
  | { type: "run"; run: SourcingRun };
