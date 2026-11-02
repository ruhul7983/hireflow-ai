import Link from "next/link";
import { CandidateMove } from "@/components/candidates/candidate-move";
import {
  DataTable,
  StatusBadge,
  tableCell,
  tableLink,
  tableRow,
} from "@/components/list/data-table";
import { LocalTime } from "@/components/list/local-time";
import { statusLabel, statusTone } from "@/lib/candidate-status";
import type { MeetingRow } from "@/lib/list-types";
import { MEETING_STATUSES } from "@/lib/meeting-status";

const COLUMNS = [
  { label: "Meeting time" },
  { label: "Candidate" },
  { label: "Job" },
  { label: "Meeting" },
  { label: "Stage" },
  { label: "Move" },
  { label: "Actions" },
];

export function MeetingsTable({ meetings }: { meetings: MeetingRow[] }) {
  return (
    <DataTable caption="Meetings" columns={COLUMNS} className="min-w-5xl">
      {meetings.map(({ id, status, startsAt, conversationId, candidate }) => {
        const { label, tone } = MEETING_STATUSES[status];

        return (
          <tr key={id} className={tableRow}>
            <td className={`${tableCell} font-medium`}>
              {startsAt ? (
                <LocalTime value={startsAt} />
              ) : (
                <span className="font-normal text-muted">Not set</span>
              )}
            </td>
            <th
              scope="row"
              className={`${tableCell} max-w-64 text-left font-semibold`}
            >
              {candidate.name ?? "Name not shown"}
              <span className="block truncate text-xs font-normal text-muted">
                {candidate.email ?? "Email not known"}
              </span>
            </th>
            <td className={`${tableCell} max-w-48`}>
              <Link
                href={`/meetings?jobId=${candidate.job.id}`}
                className={tableLink}
              >
                {candidate.job.title}
              </Link>
            </td>
            <td className={tableCell}>
              <StatusBadge label={label} tone={tone} />
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
            <td className={tableCell}>
              <Link
                href={`/chat?c=${conversationId}`}
                className={`whitespace-nowrap ${tableLink}`}
              >
                Open chat
              </Link>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
