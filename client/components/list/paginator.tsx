"use client";

import { Fragment } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useList } from "@/components/list/list-context";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/list";
import type { Paged } from "@/lib/list";

const buttonClass =
  "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40";

// The first, the last and the neighbours, so a long list stays one short row
function visiblePages(page: number, totalPages: number) {
  const wanted = [1, page - 1, page, page + 1, totalPages].filter(
    (number) => number >= 1 && number <= totalPages,
  );
  return [...new Set(wanted)].sort((a, b) => a - b);
}

type PaginatorProps = Omit<Paged<unknown>, "items"> & { label: string };

export function Paginator({
  page,
  pageSize,
  total,
  totalPages,
  label,
}: PaginatorProps) {
  const { pending, setParams } = useList();
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function goTo(target: number) {
    setParams(
      { page: target > 1 ? String(target) : undefined },
      { scroll: true },
    );
  }

  return (
    <nav
      aria-label={`${label} pages`}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm"
    >
      <p role="status" className="text-muted">
        Showing <span className="font-medium text-ink tabular-nums">{first}–{last}</span>{" "}
        of <span className="font-medium text-ink tabular-nums">{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-muted">
          Rows per page
          <select
            key={pageSize}
            defaultValue={pageSize}
            onChange={({ target }) =>
              setParams({
                pageSize:
                  Number(target.value) === DEFAULT_PAGE_SIZE
                    ? undefined
                    : target.value,
              })
            }
            className="rounded-lg border border-muted/70 bg-surface px-2 py-1.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={pending || page <= 1}
            aria-label="Previous page"
            className={`${buttonClass} hover:bg-canvas`}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>

          {visiblePages(page, totalPages).map((number, index, pages) => (
            <Fragment key={number}>
              {index > 0 && number - pages[index - 1] > 1 && (
                <span aria-hidden className="px-1 text-muted">
                  …
                </span>
              )}
              <button
                type="button"
                onClick={() => goTo(number)}
                disabled={pending}
                aria-label={`Page ${number}`}
                aria-current={number === page ? "page" : undefined}
                className={`${buttonClass} ${
                  number === page
                    ? "bg-brand-soft text-brand-strong"
                    : "text-muted hover:bg-canvas"
                }`}
              >
                {number}
              </button>
            </Fragment>
          ))}

          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={pending || page >= totalPages}
            aria-label="Next page"
            className={`${buttonClass} hover:bg-canvas`}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  );
}
