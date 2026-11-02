import type { Metadata } from "next";
import { Suspense } from "react";
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
import { MeetingsTable } from "@/components/meetings/meetings-table";
import { getFromBackend, getList } from "@/lib/backend-fetch";
import { readListParams } from "@/lib/list";
import type { RawSearchParams } from "@/lib/list";
import type { JobOption, MeetingRow } from "@/lib/list-types";
import { MEETING_STATUSES, MEETING_WINDOWS } from "@/lib/meeting-status";

export const metadata: Metadata = {
  title: "Meetings | HireFlow AI",
};

// Completed is left out, because nothing sets a meeting to it yet
const STATUS_OPTIONS = Object.entries(MEETING_STATUSES)
  .filter(([value]) => value !== "COMPLETED")
  .map(([value, { label }]) => ({ value, label }));

async function MeetingsContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { page, pageSize, search, jobId, status, when } = readListParams(
    await searchParams,
    {
      status: STATUS_OPTIONS.map(({ value }) => value),
      when: MEETING_WINDOWS.map(({ value }) => value),
    },
  );

  const [meetings, jobs] = await Promise.all([
    getList<MeetingRow>("/meetings", {
      page,
      pageSize,
      search,
      jobId,
      status,
      when,
    }),
    getFromBackend<JobOption[]>("/jobs/options"),
  ]);

  if (!meetings) return <ListError noun="meetings" />;

  // The rows stay here, so they aren't sent to the browser a second time
  const { items, ...pageInfo } = meetings;

  return (
    <ListProvider>
      <ListToolbar>
        <SearchBox
          value={search}
          placeholder="Search by candidate, email or job"
        />
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
          param="when"
          label="Filter by time"
          allLabel="Any time"
          value={when}
          options={MEETING_WINDOWS}
        />
        <FilterSelect
          param="status"
          label="Filter by meeting status"
          allLabel="All statuses"
          value={status}
          options={STATUS_OPTIONS}
        />
      </ListToolbar>

      <ListBody>
        {pageInfo.total === 0 ? (
          <ListEmpty
            title="No meetings yet"
            hint="When a candidate asks to meet, their meeting will show up here."
            filtered={Boolean(search || jobId || status || when)}
          />
        ) : (
          <>
            <MeetingsTable meetings={items} />
            <Paginator {...pageInfo} label="Meetings" />
          </>
        )}
      </ListBody>
    </ListProvider>
  );
}

export default function MeetingsPage({ searchParams }: PageProps<"/meetings">) {
  return (
    <ListPage
      title="Meetings"
      description="Every meeting across your jobs, in one place."
    >
      <Suspense fallback={<ListSkeleton noun="meetings" />}>
        <MeetingsContent searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
