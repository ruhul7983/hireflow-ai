import type { Metadata } from "next";
import { Suspense } from "react";
import { CampaignsTable } from "@/components/campaigns/campaigns-table";
import { ListBody, ListProvider } from "@/components/list/list-context";
import {
  ListError,
  ListPage,
  ListSkeleton,
} from "@/components/list/list-page";
import { ListEmpty } from "@/components/list/list-states";
import {
  FilterSelect,
  ListToolbar,
  SearchBox,
} from "@/components/list/list-toolbar";
import { Paginator } from "@/components/list/paginator";
import { getFromBackend, getList } from "@/lib/backend-fetch";
import { CAMPAIGN_STATUSES } from "@/lib/campaign-status";
import { readListParams } from "@/lib/list";
import type { RawSearchParams } from "@/lib/list";
import type { CampaignRow, JobOption } from "@/lib/list-types";

export const metadata: Metadata = {
  title: "Campaigns | HireFlow AI",
};

const STATUS_OPTIONS = Object.entries(CAMPAIGN_STATUSES).map(
  ([value, { label }]) => ({ value, label }),
);

async function CampaignsContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { page, pageSize, search, jobId, status } = readListParams(
    await searchParams,
    { status: Object.keys(CAMPAIGN_STATUSES) },
  );

  const [campaigns, jobs] = await Promise.all([
    getList<CampaignRow>("/campaigns", {
      page,
      pageSize,
      search,
      jobId,
      status,
    }),
    getFromBackend<JobOption[]>("/jobs/options"),
  ]);

  if (!campaigns) return <ListError noun="campaigns" />;

  // The rows stay here, so they aren't sent to the browser a second time
  const { items, ...pageInfo } = campaigns;

  return (
    <ListProvider>
      <ListToolbar>
        <SearchBox value={search} placeholder="Search by campaign or job" />
        <FilterSelect
          param="jobId"
          label="Filter by job"
          allLabel="All jobs"
          value={jobId}
          options={(jobs ?? []).map(({ id, title }) => ({
            value: id,
            label: title,
          }))}
        />
        <FilterSelect
          param="status"
          label="Filter by status"
          allLabel="All statuses"
          value={status}
          options={STATUS_OPTIONS}
        />
      </ListToolbar>

      <ListBody>
        {pageInfo.total === 0 ? (
          <ListEmpty
            title="No campaigns yet"
            hint="Accept some candidates in chat, then set up outreach."
            filtered={Boolean(search || jobId || status)}
          />
        ) : (
          <>
            <CampaignsTable campaigns={items} />
            <Paginator {...pageInfo} label="Campaigns" />
          </>
        )}
      </ListBody>
    </ListProvider>
  );
}

export default function CampaignsPage({
  searchParams,
}: PageProps<"/campaigns">) {
  return (
    <ListPage
      title="Campaigns"
      description="Your outreach across every job, newest first."
    >
      <Suspense fallback={<ListSkeleton noun="campaigns" />}>
        <CampaignsContent searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
