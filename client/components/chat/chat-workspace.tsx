"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Bot, Plus, SendHorizontal } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { api, errorMessage, refreshSession } from "@/lib/api";
import type {
  ChatEvent,
  ChatMessage,
  Conversation,
  ConversationSummary,
  SourcingRun,
} from "@/lib/chat-types";

const QUERY_KEY = "c";
const PINNED_DISTANCE = 80;

function remember(conversationId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(QUERY_KEY, conversationId);
  window.history.replaceState(null, "", url);
}

function withRun(conversation: Conversation, run: SourcingRun): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.sourcingRun?.id === run.id
        ? { ...message, sourcingRun: { ...message.sourcingRun, ...run } }
        : message,
    ),
  };
}

function optimisticMessage(content: string): ChatMessage {
  return {
    id: `sending-${Date.now()}`,
    role: "USER",
    content,
    cardType: null,
    jobId: null,
    campaignId: null,
    jobDraft: null,
    job: null,
    sourcingRun: null,
    pendingAction: null,
    question: null,
    reply: null,
    meeting: null,
  };
}

export function ChatWorkspace() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [streamKey, setStreamKey] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const pinnedToBottom = useRef(true);

  const activeId = conversation?.id ?? null;
  const waitingQuestionId = conversation?.messages.find(
    ({ question }) => question?.status === "PENDING",
  )?.id;

  const reloadList = useCallback(async () => {
    setConversations(await api<ConversationSummary[]>("/chat/conversations"));
  }, []);

  const open = useCallback(async (id: string) => {
    pinnedToBottom.current = true;
    setConversation(await api<Conversation>(`/chat/conversations/${id}`));
    remember(id);
  }, []);

  const startNew = useCallback(async () => {
    const created = await api<ConversationSummary>("/chat/conversations", {
      method: "POST",
    });
    await open(created.id);
    await reloadList();
  }, [open, reloadList]);

  const refresh = useCallback(async () => {
    if (!activeId) return;
    setRefreshKey((key) => key + 1);
    setConversation(await api<Conversation>(`/chat/conversations/${activeId}`));
    await reloadList();
  }, [activeId, reloadList]);

  useEffect(() => {
    async function load() {
      try {
        const list = await api<ConversationSummary[]>("/chat/conversations");
        setConversations(list);

        const requested = new URL(window.location.href).searchParams.get(QUERY_KEY);
        const target = list.find(({ id }) => id === requested) ?? list[0];
        await (target ? open(target.id) : startNew());
      } catch (cause) {
        setError(errorMessage(cause));
      }
    }

    void load();
  }, [open, startNew]);

  // Background jobs report here, so results appear without a refresh
  useEffect(() => {
    if (!activeId) return;

    const source = new EventSource(`/api/chat/conversations/${activeId}/events`);

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as ChatEvent;
      if (data.type === "run") {
        setConversation((current) => current && withRun(current, data.run));
      }
      if (data.type === "changed") {
        void refresh().catch(() => undefined);
      }
    };

    // Closed means the server refused it, usually an expired access token.
    // Other errors are dropped connections, which EventSource retries by itself.
    source.onerror = () => {
      if (source.readyState !== EventSource.CLOSED) return;
      void refreshSession().then((renewed) => {
        if (renewed) setStreamKey((key) => key + 1);
      });
    };

    return () => source.close();
  }, [activeId, refresh, streamKey]);

  // Cards load their rows after they mount, so follow the content as it grows
  useEffect(() => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list) return;

    const observer = new ResizeObserver(() => {
      if (pinnedToBottom.current) scroller.scrollTop = scroller.scrollHeight;
    });

    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  // A question is waiting on the recruiter, so it must never appear off-screen
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!waitingQuestionId || !scroller) return;

    pinnedToBottom.current = true;
    scroller.scrollTop = scroller.scrollHeight;
  }, [waitingQuestionId]);

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const distance =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    pinnedToBottom.current = distance < PINNED_DISTANCE;
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || !conversation || sending) return;

    pinnedToBottom.current = true;
    setDraft("");
    setSending(true);
    setError(null);
    setConversation({
      ...conversation,
      messages: [...conversation.messages, optimisticMessage(content)],
    });

    try {
      const updated = await api<Conversation>(
        `/chat/conversations/${conversation.id}/messages`,
        { method: "POST", body: JSON.stringify({ content }) },
      );
      setConversation(updated);
      setRefreshKey((key) => key + 1);
      await reloadList();
    } catch (cause) {
      setDraft(content);
      setError(errorMessage(cause));
      await refresh().catch(() => undefined);
    }
    setSending(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function handleNew() {
    setError(null);
    startNew().catch((cause) => setError(errorMessage(cause)));
  }

  function handleOpen(id: string) {
    setError(null);
    open(id).catch((cause) => setError(errorMessage(cause)));
  }

  return (
    <main className="flex h-[calc(100dvh-57px)] lg:h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line md:flex">
        <div className="p-3">
          <button
            type="button"
            onClick={handleNew}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Plus className="size-4" aria-hidden />
            New chat
          </button>
        </div>
        <nav aria-label="Chats" className="flex-1 overflow-y-auto px-3 pb-3">
          <ul className="space-y-1">
            {conversations.map(({ id, title }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => handleOpen(id)}
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
          </ul>
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line p-3 md:hidden">
          <select
            aria-label="Choose a chat"
            value={activeId ?? ""}
            onChange={(event) => handleOpen(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-muted/70 bg-surface px-2 py-2 text-sm"
          >
            {conversations.map(({ id, title }) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleNew}
            aria-label="New chat"
            className="rounded-lg bg-brand p-2 text-white"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>

        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <ol
            ref={listRef}
            className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6"
          >
            {conversation?.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                conversationId={conversation.id}
                refreshKey={refreshKey}
                onChanged={() => void refresh().catch(() => undefined)}
              />
            ))}
            {sending && (
              <li className="flex items-center gap-3" role="status">
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-strong"
                >
                  <Bot className="size-4" />
                </span>
                <span className="text-sm text-muted">Thinking…</span>
              </li>
            )}
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="border-t border-line p-3 sm:p-4">
          <div className="mx-auto w-full max-w-5xl space-y-2">
            {error && (
              <p role="alert" className="text-sm font-medium text-danger-strong">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2 rounded-xl border border-muted/70 p-2 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/20">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                aria-label="Message"
                placeholder="Paste a job description, share a link, or ask anything"
                className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim() || !conversation}
                aria-label="Send message"
                className="rounded-lg bg-brand p-2.5 text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
              >
                <SendHorizontal className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
