import Link from "next/link";
import { Panel } from "@/components/dashboard/panel";
import { formatPercentage } from "@/lib/dashboard-format";
import type { DashboardJob } from "@/lib/dashboard-types";

const NUMERIC_COLUMNS = [
  "Candidates",
  "Reply rate",
  "Interested",
  "Meetings",
  "Hires",
];

const PHASE_TONES: Record<DashboardJob["phase"], string> = {
  Sourcing: "bg-warning-soft text-warning-strong",
  Outreach: "bg-brand-soft text-brand-strong",
  Interviewing: "bg-success-soft text-success-strong",
  Hired: "bg-success-soft text-success-strong",
};

const WORK_MODES = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" };

function jobLocation({ location, remotePolicy }: DashboardJob) {
  const parts = [location, remotePolicy && WORK_MODES[remotePolicy]];
  return parts.filter(Boolean).join(" · ") || "Location not set";
}

type JobsTableProps = {
  jobs: DashboardJob[];
  className?: string;
};

export function JobsTable({ jobs, className = "" }: JobsTableProps) {
  return (
    <Panel
      title="Jobs"
      description="Progress for every open role"
      className={className}
    >
      {/* Scrolls inside the panel so a narrow screen never scrolls the page sideways */}
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-2xl text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th scope="col" className="pb-2.5 font-medium">
                Job
              </th>
              <th scope="col" className="pb-2.5 font-medium">
                Phase
              </th>
              {NUMERIC_COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="pb-2.5 pl-4 text-right font-medium"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr
                key={job.id}
                className="border-b border-line last:border-0 hover:bg-canvas"
              >
                <th scope="row" className="py-3 pr-4 text-left font-semibold">
                  {job.conversationId ? (
                    <Link
                      href={`/chat?c=${job.conversationId}`}
                      className="hover:text-brand-strong hover:underline"
                    >
                      {job.title}
                    </Link>
                  ) : (
                    job.title
                  )}
                  <span className="block text-xs font-normal text-muted">
                    {jobLocation(job)}
                  </span>
                </th>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PHASE_TONES[job.phase]}`}
                  >
                    {job.phase}
                  </span>
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {job.funnel.sourced}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {formatPercentage(job.replyRate)}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {formatPercentage(job.interestedRate)}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {job.funnel.meetings}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {job.funnel.hired}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
