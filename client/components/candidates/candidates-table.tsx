import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CandidateMove } from "@/components/candidates/candidate-move";
import {
  DataTable,
  StatusBadge,
  tableCell,
  tableLink,
  tableRow,
} from "@/components/list/data-table";
import { scoreTone, statusLabel, statusTone } from "@/lib/candidate-status";
import type { CandidateRow } from "@/lib/list-types";

const COLUMNS = [
  { label: "Score" },
  { label: "Candidate" },
  { label: "Job" },
  { label: "Why" },
  { label: "Status" },
  { label: "Move" },
];

export function CandidatesTable({ candidates }: { candidates: CandidateRow[] }) {
  return (
    <DataTable caption="Candidates" columns={COLUMNS} className="min-w-5xl">
      {candidates.map((candidate) => (
        <tr key={candidate.id} className={tableRow}>
          <td className={tableCell}>
            {candidate.score === null ? (
              <span className="text-xs text-muted">Scoring…</span>
            ) : (
              <span
                className={`inline-block min-w-9 rounded-md px-1.5 py-0.5 text-center font-semibold tabular-nums ${scoreTone(candidate.score)}`}
              >
                {candidate.score}
              </span>
            )}
          </td>
          <th scope="row" className={`${tableCell} max-w-64 text-left font-medium`}>
            {candidate.profileUrl ? (
              <a
                href={candidate.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 ${tableLink}`}
              >
                {candidate.name ?? "View profile"}
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            ) : (
              (candidate.name ?? "Name not shown")
            )}
            {candidate.headline && (
              <span className="mt-0.5 line-clamp-2 text-xs font-normal text-muted">
                {candidate.headline}
              </span>
            )}
            <span className="mt-0.5 block truncate text-xs font-normal text-muted">
              {[candidate.email ?? "Email not known", candidate.location]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </th>
          <td className={`${tableCell} max-w-48`}>
            <Link
              href={`/candidates?jobId=${candidate.job.id}`}
              className={tableLink}
            >
              {candidate.job.title}
            </Link>
          </td>
          <td className={`${tableCell} max-w-80 text-muted`}>
            <span
              title={candidate.scoreReason ?? undefined}
              className="line-clamp-2"
            >
              {candidate.scoreReason ?? "Not scored yet"}
            </span>
          </td>
          <td className={tableCell}>
            <StatusBadge
              label={statusLabel(candidate.status)}
              tone={statusTone(candidate.status)}
            />
          </td>
          <td className={tableCell}>
            <CandidateMove candidate={candidate} />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
