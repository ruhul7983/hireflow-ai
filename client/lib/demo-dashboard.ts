// Sample data for the dashboard preview. Replace with real API calls once jobs exist.
// Every total and rate below is derived from `jobs`, so the page can't disagree with itself.

const STAGES = [
  { key: "sourced", label: "Sourced" },
  { key: "accepted", label: "Accepted" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "interested", label: "Interested" },
  { key: "meetings", label: "Meeting booked" },
  { key: "interviewed", label: "Interviewed" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "hired", label: "Hired" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

export type DemoJob = {
  id: string;
  title: string;
  location: string;
  phase: "Sourcing" | "Outreach" | "Interviewing";
  // How many candidates have reached each stage
  funnel: Record<StageKey, number>;
};

export const jobs: DemoJob[] = [
  {
    id: "senior-react",
    title: "Senior React Engineer",
    location: "Dhaka · Hybrid",
    phase: "Interviewing",
    funnel: {
      sourced: 124,
      accepted: 42,
      contacted: 38,
      replied: 19,
      interested: 11,
      meetings: 7,
      interviewed: 5,
      shortlisted: 3,
      hired: 1,
    },
  },
  {
    id: "backend-node",
    title: "Backend Engineer, Node.js",
    location: "Remote",
    phase: "Interviewing",
    funnel: {
      sourced: 96,
      accepted: 35,
      contacted: 31,
      replied: 13,
      interested: 8,
      meetings: 5,
      interviewed: 3,
      shortlisted: 1,
      hired: 0,
    },
  },
  {
    id: "product-designer",
    title: "Product Designer",
    location: "Dhaka · On-site",
    phase: "Interviewing",
    funnel: {
      sourced: 71,
      accepted: 24,
      contacted: 22,
      replied: 12,
      interested: 7,
      meetings: 4,
      interviewed: 4,
      shortlisted: 2,
      hired: 1,
    },
  },
  {
    id: "ai-engineer",
    title: "AI Engineer",
    location: "Remote",
    phase: "Outreach",
    funnel: {
      sourced: 58,
      accepted: 20,
      contacted: 18,
      replied: 6,
      interested: 3,
      meetings: 2,
      interviewed: 1,
      shortlisted: 0,
      hired: 0,
    },
  },
  {
    id: "devops",
    title: "DevOps Engineer",
    location: "Chattogram · Hybrid",
    phase: "Sourcing",
    funnel: {
      sourced: 43,
      accepted: 14,
      contacted: 0,
      replied: 0,
      interested: 0,
      meetings: 0,
      interviewed: 0,
      shortlisted: 0,
      hired: 0,
    },
  },
];

function total(key: StageKey) {
  return jobs.reduce((sum, job) => sum + job.funnel[key], 0);
}

// Returns null rather than 0 when nothing has happened yet, so the UI shows a dash
export function percentage(part: number, whole: number) {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

export function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

export const funnel = STAGES.map(({ key, label }) => ({
  key,
  label,
  count: total(key),
}));

// Each column adds up to the matching total across `jobs`
export const weeks = [
  { week: "Sep 7", sourced: 32, contacted: 6, replied: 2, interested: 1, meetings: 0, hired: 0 },
  { week: "Sep 14", sourced: 41, contacted: 10, replied: 4, interested: 2, meetings: 1, hired: 0 },
  { week: "Sep 21", sourced: 48, contacted: 12, replied: 5, interested: 3, meetings: 2, hired: 0 },
  { week: "Sep 28", sourced: 52, contacted: 15, replied: 7, interested: 4, meetings: 2, hired: 0 },
  { week: "Oct 5", sourced: 46, contacted: 13, replied: 6, interested: 3, meetings: 2, hired: 1 },
  { week: "Oct 12", sourced: 58, contacted: 17, replied: 8, interested: 5, meetings: 3, hired: 0 },
  { week: "Oct 19", sourced: 60, contacted: 18, replied: 9, interested: 5, meetings: 4, hired: 0 },
  { week: "Oct 26", sourced: 55, contacted: 18, replied: 9, interested: 6, meetings: 4, hired: 1 },
];

type WeeklyMetric = Exclude<keyof (typeof weeks)[number], "week">;

export function weeklySeries(metric: WeeklyMetric) {
  return weeks.map((week) => week[metric]);
}

function sumWeeks(metric: WeeklyMetric, from: number, to: number) {
  return weeks
    .slice(from, to)
    .reduce((sum, week) => sum + week[metric], 0);
}

// Trends compare the latest four weeks with the four before them
const half = weeks.length / 2;
const earlier = (metric: WeeklyMetric) => sumWeeks(metric, 0, half);
const recent = (metric: WeeklyMetric) => sumWeeks(metric, half, weeks.length);

function rateChange(part: WeeklyMetric, whole: WeeklyMetric) {
  const before = percentage(earlier(part), earlier(whole)) ?? 0;
  const after = percentage(recent(part), recent(whole)) ?? 0;
  return after - before;
}

export const summary = {
  openJobs: jobs.length,
  interviewingJobs: jobs.filter((job) => job.phase === "Interviewing").length,
  sourced: total("sourced"),
  replied: total("replied"),
  replyRate: percentage(total("replied"), total("contacted")),
  interestedRate: percentage(total("interested"), total("replied")),
  meetings: total("meetings"),
  hires: total("hired"),
  sourcedChange: percentage(recent("sourced") - earlier("sourced"), earlier("sourced")) ?? 0,
  replyRateChange: rateChange("replied", "contacted"),
  interestedRateChange: rateChange("interested", "replied"),
  meetingsChange: recent("meetings") - earlier("meetings"),
  hiresChange: recent("hired") - earlier("hired"),
};

// Adds up to the `replied` total. Interested + Wants a meeting matches `interested`.
export const replyOutcomes = [
  { label: "Wants a meeting", count: 18, color: "var(--color-brand)" },
  { label: "Interested", count: 11, color: "var(--color-success)" },
  { label: "Question", count: 6, color: "var(--color-warning)" },
  { label: "Not interested", count: 12, color: "var(--color-danger)" },
  { label: "Unsubscribe", count: 3, color: "var(--color-info)" },
];

export type DemoApproval = {
  id: string;
  kind: "reply" | "campaign";
  title: string;
  job: string;
};

export const approvals: DemoApproval[] = [
  {
    id: "1",
    kind: "reply",
    title: "Reply to Tanvir Hasan",
    job: "AI Engineer",
  },
  {
    id: "2",
    kind: "campaign",
    title: "3-step campaign to 14 candidates",
    job: "DevOps Engineer",
  },
  {
    id: "3",
    kind: "reply",
    title: "Reply to Nadia Rahman",
    job: "Senior React Engineer",
  },
];

export type DemoActivity = {
  id: string;
  actor: "AI" | "Recruiter";
  summary: string;
  job: string;
  time: string;
};

export const activity: DemoActivity[] = [
  {
    id: "1",
    actor: "AI",
    summary: "Nadia Rahman replied and wants a meeting",
    job: "Senior React Engineer",
    time: "12 min ago",
  },
  {
    id: "2",
    actor: "AI",
    summary: "Drafted a reply to Tanvir Hasan, waiting for approval",
    job: "AI Engineer",
    time: "48 min ago",
  },
  {
    id: "3",
    actor: "Recruiter",
    summary: "Moved Farhan Kabir to Shortlisted",
    job: "Backend Engineer, Node.js",
    time: "2 hours ago",
  },
  {
    id: "4",
    actor: "AI",
    summary: "Scored 43 candidates from today's sourcing run",
    job: "DevOps Engineer",
    time: "5 hours ago",
  },
  {
    id: "5",
    actor: "Recruiter",
    summary: "Marked Sadia Islam as Hired",
    job: "Product Designer",
    time: "Yesterday",
  },
];
