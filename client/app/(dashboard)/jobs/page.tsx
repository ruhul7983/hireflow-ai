import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsTable } from "@/components/jobs/jobs-table";
import { ListBody, ListProvider } from "@/components/list/list-context";
import {
  ListError,
  ListPage,
  ListSkeleton,
} from "@/components/list/list-page";
import { ListEmpty } from "@/components/list/list-states";
import { ListToolbar, SearchBox } from "@/components/list/list-toolbar";
import { Paginator } from "@/components/list/paginator";
import { getList } from "@/lib/backend-fetch";
import { readListParams } from "@/lib/list";
import type { RawSearchParams } from "@/lib/list";
import type { JobRow } from "@/lib/list-types";

export const metadata: Metadata = {
  title: "Jobs | HireFlow AI",
};

async function JobsContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { page, pageSize, search } = readListParams(await searchParams);
  const jobs = await getList<JobRow>("/jobs", { page, pageSize, search });

  if (!jobs) return <ListError noun="jobs" />;

  // The rows stay here, so they aren't sent to the browser a second time
  const { items, ...pageInfo } = jobs;

  return (
    <ListProvider>
      <ListToolbar>
        <SearchBox value={search} placeholder="Search by title or location" />
      </ListToolbar>

      <ListBody>
        {pageInfo.total === 0 ? (
          <ListEmpty
            title="No jobs yet"
            hint="Paste a job description in chat to create your first job."
            filtered={Boolean(search)}
          />
        ) : (
          <>
            <JobsTable jobs={items} />
            <Paginator {...pageInfo} label="Jobs" />
          </>
        )}
      </ListBody>
    </ListProvider>
  );
}

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <ListPage
      title="Jobs"
      description="Every role you're hiring for, newest first."
    >
      <Suspense fallback={<ListSkeleton noun="jobs" />}>
        <JobsContent searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
