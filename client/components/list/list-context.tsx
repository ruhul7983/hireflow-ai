"use client";

import { createContext, use, useTransition } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

type ParamChanges = Record<string, string | undefined>;
type ParamOptions = { history?: "push" | "replace"; scroll?: boolean };

type ListContextValue = {
  pending: boolean;
  setParams: (changes: ParamChanges, options?: ParamOptions) => void;
  refresh: () => void;
};

const ListContext = createContext<ListContextValue | null>(null);

export function useList() {
  const list = use(ListContext);
  if (!list) throw new Error("useList needs a ListProvider around it");
  return list;
}

// The URL holds the page and filters, so the server renders each view and links,
// refresh and the back button all land on the same rows
export function ListProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function setParams(
    changes: ParamChanges,
    { history = "push", scroll = false }: ParamOptions = {},
  ) {
    // Read at call time, so a delayed search keeps a filter chosen in the meantime
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Any other change means different rows, so page 7 may no longer exist
    if (!("page" in changes)) params.delete("page");

    const query = params.toString();
    startTransition(() => {
      router[history](query ? `${pathname}?${query}` : pathname, { scroll });
    });
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <ListContext value={{ pending, setParams, refresh }}>{children}</ListContext>
  );
}

// Keeps the old rows on screen, dimmed, until the next ones arrive
export function ListBody({ children }: { children: ReactNode }) {
  const { pending } = useList();

  return (
    <div
      aria-busy={pending}
      className={`space-y-4 transition-opacity ${pending ? "opacity-60" : ""}`}
    >
      {children}
    </div>
  );
}
