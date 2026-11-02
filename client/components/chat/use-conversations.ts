"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  ConversationPage,
  ConversationScope,
  ConversationSummary,
} from "@/lib/chat-types";
import { toQueryString } from "@/lib/list";

function fetchPage(scope: ConversationScope, cursor?: string) {
  return api<ConversationPage>(
    `/chat/conversations?${toQueryString({ scope, cursor })}`,
  );
}

function withoutRepeats(
  first: ConversationSummary[],
  second: ConversationSummary[],
) {
  const seen = new Set(first.map(({ id }) => id));
  return [...first, ...second.filter(({ id }) => !seen.has(id))];
}

export function useConversations() {
  const [scope, setScope] = useState<ConversationScope>("all");
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // In refs so changing tabs doesn't rebuild the callbacks the chat page depends on
  const activeScope = useRef<ConversationScope>("all");
  const busy = useRef(false);

  // Refreshes the top of the list and keeps whatever has been scrolled to already
  const reload = useCallback(async () => {
    const asked = activeScope.current;
    const page = await fetchPage(asked);
    if (asked !== activeScope.current) return page.items;

    setItems((current) => withoutRepeats(page.items, current));
    setNextCursor((current) => current ?? page.nextCursor);
    return page.items;
  }, []);

  async function loadMore() {
    if (!nextCursor || busy.current) return;

    busy.current = true;
    setLoading(true);
    const asked = activeScope.current;

    try {
      const page = await fetchPage(asked, nextCursor);
      if (asked === activeScope.current) {
        setItems((current) => withoutRepeats(current, page.items));
        setNextCursor(page.nextCursor);
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function changeScope(next: ConversationScope) {
    if (next === activeScope.current) return;

    activeScope.current = next;
    setScope(next);
    setItems([]);
    setNextCursor(null);
    setLoading(true);

    try {
      const page = await fetchPage(next);
      if (next === activeScope.current) {
        setItems(page.items);
        setNextCursor(page.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    scope,
    items,
    loading,
    hasMore: nextCursor !== null,
    reload,
    loadMore,
    changeScope,
  };
}

export type ConversationsState = ReturnType<typeof useConversations>;
