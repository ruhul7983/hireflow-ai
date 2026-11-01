import type { Metadata } from "next";
import { Suspense } from "react";
import { ACTORS, ActivityLog } from "@/components/activity/activity-log";
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
import type { ActivityEntry } from "@/lib/chat-types";
import { readListParams } from "@/lib/list";
import type { RawSearchParams } from "@/lib/list";
import type { JobOption } from "@/lib/list-types";

export const metadata: Metadata = {
  title: "Activity | HireFlow AI",
};

const ACTOR_OPTIONS = Object.entries(ACTORS).map(([value, { label }]) => ({
  value,
  label,
}));

async function ActivityContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { page, pageSize, search, jobId, actor } = readListParams(
    await searchParams,
    { actor: Object.keys(ACTORS) },
  );

  const [activity, jobs] = await Promise.all([
    getList<ActivityEntry>("/activity", {
      page,
      pageSize,
      search,
      jobId,
      actor,
    }),
    getFromBackend<JobOption[]>("/jobs/options"),
  ]);

  if (!activity) return <ListError noun="activity" />;

  // The rows stay here, so they aren't sent to the browser a second time
  const { items, ...pageInfo } = activity;

  return (
    <ListProvider>
      <ListToolbar>
        <SearchBox value={search} placeholder="Search activity" />
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
          param="actor"
          label="Filter by who did it"
          allLabel="Everyone"
          value={actor}
          options={ACTOR_OPTIONS}
        />
      </ListToolbar>

      <ListBody>
        {pageInfo.total === 0 ? (
          <ListEmpty
            title="Nothing has happened yet"
            hint="Everything you and the AI do across your jobs will show up here."
            filtered={Boolean(search || jobId || actor)}
          />
        ) : (
          <>
            <ActivityLog entries={items} />
            <Paginator {...pageInfo} label="Activity" />
          </>
        )}
      </ListBody>
    </ListProvider>
  );
}

export default function ActivityPage({ searchParams }: PageProps<"/activity">) {
  return (
    <ListPage
      title="Activity"
      description="Every change across your jobs, newest first."
    >
      <Suspense fallback={<ListSkeleton noun="activity" />}>
        <ActivityContent searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
