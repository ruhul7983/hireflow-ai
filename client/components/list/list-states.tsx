"use client";

import Link from "next/link";
import { secondaryButton } from "@/components/chat/action-buttons";
import { useList } from "@/components/list/list-context";

const FILTER_PARAMS = ["search", "status", "actor", "jobId", "when"];

type ListEmptyProps = {
  title: string;
  hint: string;
  filtered: boolean;
};

export function ListEmpty({ title, hint, filtered }: ListEmptyProps) {
  const { setParams } = useList();

  return (
    <section className="rounded-xl border border-line p-8 text-center">
      <h2 className="text-lg font-semibold tracking-tight">
        {filtered ? "Nothing matches these filters" : title}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {filtered ? "Try a different search, or clear the filters." : hint}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={() =>
            setParams(
              Object.fromEntries(FILTER_PARAMS.map((key) => [key, undefined])),
            )
          }
          className={`${secondaryButton} mt-4`}
        >
          Clear filters
        </button>
      ) : (
        <Link
          href="/chat"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          Open chat
        </Link>
      )}
    </section>
  );
}
