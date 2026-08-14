"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  School,
  MessageSquare,
  MessageSquarePlus,
  Search,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { NewConversationDialog } from "./new-conversation-dialog";
import { UnreadBadge } from "./unread-badge";
import {
  listThreadsAction,
  markReadAction,
  getUnreadMessagesCountAction,
} from "@/server/actions/messaging";
import type { ThreadListItem } from "@/server/services/messaging";
import { cn } from "@/lib/utils";

export interface ThreadListProps {
  /** Currently selected thread id (highlighted). */
  activeThreadId?: string;
  /** When true, the component shows a "back to inbox" header on mobile. */
  showBackOnMobile?: boolean;
}

function peerInitials(p: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const f = p.firstName?.[0] ?? "";
  const l = p.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function peerName(p: {
  firstName: string | null;
  lastName: string | null;
}): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
}

function formatRelative(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60_000) return "à l'instant";
  if (diff < 60 * 60 * 1000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < day) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 2 * day) return "hier";
  if (diff < 7 * day) return `il y a ${Math.floor(diff / day)} j`;
  return d.toLocaleDateString();
}

/**
 * §5.11 — Sidebar list of conversation threads.
 *
 * - Loads threads on mount via `listThreadsAction`.
 * - Highlights the active thread.
 * - On click, navigates to `/messages/[threadId]`.
 * - Marks the thread as read when opened.
 * - Polls the global unread count every 30s to refresh badges.
 */
export function ThreadList({ activeThreadId, showBackOnMobile }: ThreadListProps) {
  const t = useTranslations("Messaging");
  const tNav = useTranslations("Navigation");
  const router = useRouter();
  const [items, setItems] = useState<ThreadListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    listThreadsAction({ page: 1, pageSize: 50 }).then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data.items : []);
    });
    // Refresh thread list every 30s to surface new messages + unread counts.
    refreshTimer.current = setInterval(() => {
      listThreadsAction({ page: 1, pageSize: 50 }).then((res) => {
        if (cancelled) return;
        if (res.success) setItems(res.data.items);
      });
    }, 30_000);
    return () => {
      cancelled = true;
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, []);

  async function handleOpen(threadId: string): Promise<void> {
    // Optimistically mark read so the badge disappears.
    setItems((prev) =>
      prev?.map((it) =>
        it.id === threadId ? { ...it, unreadCount: 0 } : it,
      ) ?? null,
    );
    await markReadAction(threadId).catch(() => {
      /* swallow — non-blocking */
    });
    router.push(`/messages/${threadId}`);
  }

  const filtered =
    items?.filter((it) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        it.peers.some((p) => peerName(p).toLowerCase().includes(q)) ||
        it.lastMessage?.body.toLowerCase().includes(q)
      );
    }) ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {showBackOnMobile && (
            <Link
              href="/messages"
              className="text-muted-foreground hover:text-foreground lg:hidden"
              aria-label={t("backToList")}
            >
              <ArrowLeft className="size-4" />
            </Link>
          )}
          <h2 className="font-display text-base font-semibold text-foreground">
            {t("threads")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <NewConversationDialog
            trigger={
              <Button
                variant="brand-glass"
                size="icon-sm"
                aria-label={t("newConversation")}
                title={t("newConversation")}
              >
                <MessageSquarePlus className="size-4" />
              </Button>
            }
          />
          <Link
            href="/messages"
            className="text-xs text-primary-700 hover:underline dark:text-primary-400"
          >
            {tNav("messages")}
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="danael-input h-8 w-full rounded-md pl-8 text-xs"
            aria-label={t("search")}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items === null ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={MessageSquare}
              title={t("noThreads")}
              description={t("noThreadsHint")}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((it) => {
              const isActive = it.id === activeThreadId;
              const firstPeer = it.peers.at(0);
              const isMulti = it.peers.length > 1;
              const threadTitle = isMulti
                ? it.peers.map((p) => peerName(p)).join(", ")
                : firstPeer
                  ? peerName(firstPeer)
                  : t("untitled");
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => void handleOpen(it.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60",
                      isActive && "bg-primary-500/10 hover:bg-primary-500/15",
                    )}
                  >
                    <Avatar className="size-10 shrink-0 border border-border">
                      {firstPeer && (
                        <AvatarFallback className="bg-primary-500/15 text-xs font-semibold text-primary-700 dark:text-primary-400">
                          {peerInitials(firstPeer)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-medium text-foreground",
                            it.unreadCount > 0 && "font-semibold",
                          )}
                        >
                          {threadTitle}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {it.lastMessage
                            ? formatRelative(it.lastMessage.createdAt as unknown as Date)
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-foreground">
                          {it.lastMessage?.body ?? t("noMessages")}
                        </span>
                        {it.unreadCount > 0 && (
                          <UnreadBadge count={it.unreadCount} />
                        )}
                      </div>
                      {/* Thread type chip */}
                      <div className="mt-1 flex items-center gap-1">
                        {it.type === "direct" ? null : it.type === "class" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-info/15 px-1.5 py-0.5 text-[9px] font-semibold text-info">
                            <Users className="size-2.5" aria-hidden />
                            {t("typeClass")}
                          </span>
                        ) : it.type === "school" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold text-warning">
                            <School className="size-2.5" aria-hidden />
                            {t("typeSchool")}
                          </span>
                        ) : it.type === "support" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-secondary-foreground">
                            {t("typeSupport")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Hook that returns the global unread messages count (for sidebar badges etc). */
export function useUnreadMessagesCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getUnreadMessagesCountAction().then((res) => {
      if (cancelled) return;
      if (res.success) setCount(res.data.count);
    });
    const timer = setInterval(() => {
      getUnreadMessagesCountAction().then((res) => {
        if (cancelled) return;
        if (res.success) setCount(res.data.count);
      });
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return count;
}
