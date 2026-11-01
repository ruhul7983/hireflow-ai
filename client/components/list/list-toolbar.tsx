"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { useList } from "@/components/list/list-context";

const SEARCH_DELAY_MS = 300;

const fieldClass =
  "rounded-lg border border-muted/70 bg-surface py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function ListToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

type SearchBoxProps = { value: string | undefined; placeholder: string };

export function SearchBox({ value = "", placeholder }: SearchBoxProps) {
  const { setParams } = useList();
  const [draft, setDraft] = useState(value);
  const [requested, setRequested] = useState(value);
  const [applied, setApplied] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  // Cleared when hidden, so a late search can't pull the recruiter back to this page
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Pages stay mounted while hidden, so a link can change the search from outside.
  // A slow response to the recruiter's own typing must not overwrite what's newer.
  if (value !== applied) {
    setApplied(value);
    if (value !== requested) {
      setDraft(value);
      setRequested(value);
    }
  }

  function change(next: string) {
    setDraft(next);
    window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      const search = next.trim();
      setRequested(search);
      if (search !== requested) {
        setParams({ search: search || undefined }, { history: "replace" });
      }
    }, SEARCH_DELAY_MS);
  }

  return (
    <div className="relative min-w-52 flex-1 sm:max-w-sm">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        type="search"
        value={draft}
        onChange={(event) => change(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={100}
        className={`${fieldClass} w-full pr-3 pl-9`}
      />
    </div>
  );
}

type FilterSelectProps = {
  param: string;
  label: string;
  allLabel: string;
  value: string | undefined;
  options: { value: string; label: string }[];
};

export function FilterSelect({
  param,
  label,
  allLabel,
  value = "",
  options,
}: FilterSelectProps) {
  const { setParams } = useList();

  return (
    // The key resets it when the URL changes, and until then the choice shows at once
    <select
      key={value}
      defaultValue={value}
      aria-label={label}
      onChange={(event) =>
        setParams({ [param]: event.target.value || undefined })
      }
      className={`${fieldClass} max-w-60 px-3`}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
