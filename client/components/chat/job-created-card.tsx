import { Briefcase } from "lucide-react";
import type { Job } from "@/lib/chat-types";

const REMOTE_LABELS = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" };

export function JobCreatedCard({ job }: { job: Job }) {
  const details = [
    job.seniority,
    job.location,
    job.remotePolicy && REMOTE_LABELS[job.remotePolicy],
    job.salary,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success-strong">
        <Briefcase className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{job.title}</p>
        <p className="text-sm text-muted">{details.join(" · ") || "No extra details"}</p>
      </div>
    </div>
  );
}
