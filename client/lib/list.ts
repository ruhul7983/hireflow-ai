export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZES = [10, 20, 50];
export const DEFAULT_PAGE_SIZE = 20;

const MAX_SEARCH_LENGTH = 100;
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// The address bar is typed by hand sometimes, so anything the API would refuse is dropped
export function readListParams<Filter extends string = never>(
  raw: RawSearchParams,
  allowed?: Record<Filter, readonly string[]>,
) {
  const page = Number(first(raw.page));
  const pageSize = Number(first(raw.pageSize));
  const search = first(raw.search)?.trim().slice(0, MAX_SEARCH_LENGTH);
  const jobId = first(raw.jobId);

  const filters = Object.fromEntries(
    Object.entries<readonly string[]>(allowed ?? {}).map(([key, values]) => {
      const value = first(raw[key]);
      return [key, value && values.includes(value) ? value : undefined];
    }),
  ) as Partial<Record<Filter, string>>;

  return {
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    search: search || undefined,
    jobId: jobId && UUID.test(jobId) ? jobId : undefined,
    ...filters,
  };
}

export function toQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query.toString();
}
