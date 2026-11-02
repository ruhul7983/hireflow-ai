"use client";

import { useEffect, useRef } from "react";
import type { ConversationsState } from "@/components/chat/use-conversations";
import { SkeletonBlock } from "@/components/dashboard/dashboard-skeleton";
import type { ConversationScope } from "@/lib/chat-types";

const TABS: { scope: ConversationScope; label: string }[] = [
  { scope: "all", label: "All chats" },
  { scope: "jobs", label: "Job chats" },
];

const SKELETON_ROWS = 4;

type ConversationListProps = {
  chats: ConversationsState;
  activeId: string | null;
  onOpen: (id: string) => void;
};

export function ConversationList({
  chats,
  activeId,
  onOpen,
}: ConversationListProps) {
  const { scope, items, loading, hasMore, loadMore, changeScope } = chats;
  const scrollerRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const latestLoadMore = useRef(loadMore);

  useEffect(() => {
    latestLoadMore.current = loadMore;
  });

  // Rebuilt after each page, so a list that still fits the screen keeps loading
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void latestLoadMore.current();
      },
      { root: scrollerRef.current, rootMargin: "120px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, hasMore]);

  return (
    <>
      <div role="group" aria-label="Filter chats" className="flex gap-1 px-3 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.scope}
            type="button"
            aria-pressed={scope === tab.scope}
            onClick={() => void changeScope(tab.scope)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-brand ${
              scope === tab.scope
                ? "bg-brand-soft text-brand-strong"
                : "text-muted hover:bg-canvas"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <nav
        ref={scrollerRef}
        aria-label="Chats"
        className="flex-1 overflow-y-auto px-3 pb-3"
      >
        <ul className="space-y-1">
          {items.map(({ id, title }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onOpen(id)}
                aria-current={id === activeId ? "true" : undefined}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-brand ${
                  id === activeId
                    ? "bg-brand-soft font-medium text-brand-strong"
                    : "text-muted hover:bg-canvas hover:text-ink"
                }`}
              >
                {title}
              </button>
            </li>
          ))}

          {hasMore && <li ref={sentinelRef} aria-hidden className="h-px" />}

          {loading &&
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li key={index} className="px-3 py-2">
                <SkeletonBlock className="h-4 w-full" />
              </li>
            ))}

          {!loading && items.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No chats here yet.</li>
          )}
        </ul>
      </nav>
    </>
  );
}
