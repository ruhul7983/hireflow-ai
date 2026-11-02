import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { AutoReplyToggle } from "@/components/jobs/auto-reply-toggle";
import {
  DataTable,
  numericCell,
  StatusBadge,
  tableCell,
  tableLink,
  tableRow,
} from "@/components/list/data-table";
import { LocalTime } from "@/components/list/local-time";
import {
  formatPercentage,
  jobLocation,
  PHASE_TONES,
} from "@/lib/dashboard-format";
import type { JobRow } from "@/lib/list-types";

const COLUMNS = [
  { label: "Job" },
  { label: "Phase" },
  { label: "Candidates", numeric: true },
  { label: "Reply rate", numeric: true },
  { label: "Interested", numeric: true },
  { label: "Meetings", numeric: true },
  { label: "Hires", numeric: true },
  { label: "Campaigns", numeric: true },
  { label: "AI usage", numeric: true },
  { label: "Auto-reply" },
  { label: "Created" },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

function costLabel(costUsd: number) {
  return costUsd > 0 && costUsd < 0.01 ? "under $0.01" : `$${costUsd.toFixed(2)}`;
}

export function JobsTable({ jobs }: { jobs: JobRow[] }) {
  return (
    <DataTable caption="Jobs" columns={COLUMNS} className="min-w-6xl">
      {jobs.map((job) => (
        <tr key={job.id} className={tableRow}>
          <th scope="row" className={`${tableCell} text-left font-semibold`}>
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
              {[job.seniority, jobLocation(job)].filter(Boolean).join(" · ")}
            </span>
          </th>
          <td className={tableCell}>
            <StatusBadge label={job.phase} tone={PHASE_TONES[job.phase]} />
          </td>
          <td className={numericCell}>
            <Link href={`/candidates?jobId=${job.id}`} className={tableLink}>
              {job.funnel.sourced}
            </Link>
          </td>
          <td className={numericCell}>{formatPercentage(job.replyRate)}</td>
          <td className={numericCell}>{formatPercentage(job.interestedRate)}</td>
          <td className={numericCell}>
            <Link
              href={`/meetings?jobId=${job.id}`}
              aria-label={`View ${job.funnel.meetings} meetings for ${job.title}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-medium text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand"
            >
              <CalendarCheck className="size-3.5" aria-hidden />
              {job.funnel.meetings}
            </Link>
          </td>
          <td className={numericCell}>{job.funnel.hired}</td>
          <td className={numericCell}>
            <Link href={`/campaigns?jobId=${job.id}`} className={tableLink}>
              {job.campaigns}
            </Link>
          </td>
          <td className={numericCell}>
            <span className="whitespace-nowrap">
              {costLabel(job.usage.costUsd)}
            </span>
            <span className="block text-xs text-muted">
              {compact.format(job.usage.tokens)} tokens
            </span>
          </td>
          <td className={tableCell}>
            <AutoReplyToggle job={job} />
          </td>
          <td className={`${tableCell} text-muted`}>
            <LocalTime value={job.createdAt} format="date" />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
