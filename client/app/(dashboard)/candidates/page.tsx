import type { Metadata } from "next";
import { Suspense } from "react";
import { CandidatesTable } from "@/components/candidates/candidates-table";
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
import { CANDIDATE_STATUSES, statusLabel } from "@/lib/candidate-status";
import { readListParams } from "@/lib/list";
import type { RawSearchParams } from "@/lib/list";
import type { CandidateRow, JobOption } from "@/lib/list-types";

export const metadata: Metadata = {
  title: "Candidates | HireFlow AI",
};

const STATUS_OPTIONS = CANDIDATE_STATUSES.map((value) => ({
  value,
  label: statusLabel(value),
}));

async function CandidatesContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { page, pageSize, search, jobId, status } = readListParams(
    await searchParams,
    { status: CANDIDATE_STATUSES },
  );

  const [candidates, jobs] = await Promise.all([
    getList<CandidateRow>("/candidates", {
      page,
      pageSize,
      search,
      jobId,
      status,
    }),
    getFromBackend<JobOption[]>("/jobs/options"),
  ]);

  if (!candidates) return <ListError noun="candidates" />;

  // The rows stay here, so they aren't sent to the browser a second time
  const { items, ...pageInfo } = candidates;

  return (
    <ListProvider>
      <ListToolbar>
        <SearchBox
          value={search}
          placeholder="Search by name, email, headline or location"
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
            title="No candidates yet"
            hint="Create a job in chat, then search for candidates or upload a CSV."
            filtered={Boolean(search || jobId || status)}
          />
        ) : (
          <>
            <CandidatesTable candidates={items} />
            <Paginator {...pageInfo} label="Candidates" />
          </>
        )}
      </ListBody>
    </ListProvider>
  );
}

export default function CandidatesPage({
  searchParams,
}: PageProps<"/candidates">) {
  return (
    <ListPage
      title="Candidates"
      description="Everyone across your jobs, highest score first."
    >
      <Suspense fallback={<ListSkeleton noun="candidates" />}>
        <CandidatesContent searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
