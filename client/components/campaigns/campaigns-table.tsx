import Link from "next/link";
import { CampaignToggle } from "@/components/campaigns/campaign-toggle";
import {
  DataTable,
  numericCell,
  StatusBadge,
  tableCell,
  tableLink,
  tableRow,
} from "@/components/list/data-table";
import { LocalTime } from "@/components/list/local-time";
import { CAMPAIGN_STATUSES } from "@/lib/campaign-status";
import type { CampaignRow } from "@/lib/list-types";

const COLUMNS = [
  { label: "Campaign" },
  { label: "Status" },
  { label: "Recipients", numeric: true },
  { label: "Progress" },
  { label: "Daily limit", numeric: true },
  { label: "Created" },
  { label: "Actions" },
];

function progressLabel({ total, sent, failed, stopped }: CampaignRow["emails"]) {
  if (total === 0) return "No emails yet";

  return [
    `${sent} of ${total} sent`,
    failed > 0 && `${failed} failed`,
    stopped > 0 && `${stopped} stopped`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function CampaignsTable({ campaigns }: { campaigns: CampaignRow[] }) {
  return (
    <DataTable caption="Campaigns" columns={COLUMNS} className="min-w-5xl">
      {campaigns.map((campaign) => {
        const { label, tone } = CAMPAIGN_STATUSES[campaign.status];
        const { total, sent } = campaign.emails;
        const canToggle =
          campaign.status === "SENDING" || campaign.status === "PAUSED";

        return (
          <tr key={campaign.id} className={tableRow}>
            <th scope="row" className={`${tableCell} text-left font-semibold`}>
              {campaign.name}
              <Link
                href={`/campaigns?jobId=${campaign.job.id}`}
                className={`block text-xs font-normal ${tableLink}`}
              >
                {campaign.job.title}
              </Link>
            </th>
            <td className={tableCell}>
              <StatusBadge label={label} tone={tone} />
            </td>
            <td className={numericCell}>{campaign.recipients}</td>
            <td className={`${tableCell} min-w-52`}>
              <div className="h-2 overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${total > 0 ? (sent / total) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                {progressLabel(campaign.emails)}
              </p>
            </td>
            <td className={numericCell}>{campaign.dailyLimit}</td>
            <td className={`${tableCell} text-muted`}>
              <LocalTime value={campaign.createdAt} format="date" />
            </td>
            <td className={tableCell}>
              <div className="flex items-center gap-3">
                {canToggle && <CampaignToggle campaign={campaign} />}
                <Link
                  href={`/chat?c=${campaign.conversationId}`}
                  className={`whitespace-nowrap ${tableLink}`}
                >
                  Open chat
                </Link>
              </div>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
