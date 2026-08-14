"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Users, School, LifeBuoy, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import {
  getThreadAction,
  listMessagesAction,
  markReadAction,
} from "@/server/actions/messaging";
import type {
  ThreadWithRelations,
  MessageWithSender,
} from "@/server/services/messaging";

export interface ThreadViewProps {
  threadId: string;
  currentUserId: string;
  /** When true, shows a "back to list" button (mobile). */
  showBackButton?: boolean;
}

function peerName(p: {
  firstName: string | null;
  lastName: string | null;
}): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
}

function peerInitials(p: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const f = p.firstName?.[0] ?? "";
  const l = p.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function groupMessagesByDay(
  items: MessageWithSender[],
): { day: string; messages: MessageWithSender[] }[] {
  const groups: { day: string; messages: MessageWithSender[] }[] = [];
  for (const m of items) {
    const d = new Date(m.createdAt as unknown as Date);
    const day = d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const last = groups.at(-1);
    if (last && last.day === day) {
      last.messages.push(m);
    } else {
      groups.push({ day, messages: [m] });
    }
  }
  return groups;
}

/**
 * §5.11 — Main conversation view (header + message list + input).
 *
 * Loads the thread + paginated messages on mount; supports "load older"
 * pagination via a `before` cursor.
 *
 * Marks the thread as read on mount.
 */
export function ThreadView({
  threadId,
  currentUserId,
  showBackButton,
}: ThreadViewProps) {
  const t = useTranslations("Messaging");
  const router = useRouter();
  const [thread, setThread] = useState<ThreadWithRelations | null | undefined>(
    undefined,
  );
  const [messages, setMessages] = useState<MessageWithSender[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getThreadAction(threadId),
      listMessagesAction({ threadId, limit: 30 }),
    ]).then(([threadRes, msgsRes]) => {
      if (cancelled) return;
      if (threadRes.success) {
        setThread(threadRes.data);
        // Mark thread as read (best-effort) — the user is viewing it.
        markReadAction(threadId).catch(() => {
          /* swallow */
        });
      } else {
        setThread(null);
      }
      if (msgsRes.success) {
        // Reverse so newest is at the bottom.
        setMessages([...msgsRes.data.items].reverse());
        setHasMore(msgsRes.data.hasMore);
      } else {
        setMessages([]);
      }
    });

    // Poll for new messages every 15s.
    pollingRef.current = setInterval(() => {
      listMessagesAction({ threadId, limit: 30 }).then((res) => {
        if (cancelled) return;
        if (res.success) {
          setMessages([...res.data.items].reverse());
          setHasMore(res.data.hasMore);
          markReadAction(threadId).catch(() => {
            /* swallow */
          });
        }
      });
    }, 15_000);

    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [threadId]);

  // Scroll to bottom when messages change.
  useEffect(() => {
    if (messages && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleLoadOlder(): Promise<void> {
    if (!messages || messages.length === 0 || loadingMore) return;
    const oldest = messages[0];
    setLoadingMore(true);
    const res = await listMessagesAction({
      threadId,
      limit: 30,
      before: new Date(oldest.createdAt as unknown as Date).toISOString(),
    });
    setLoadingMore(false);
    if (!res.success) return;
    const older = [...res.data.items].reverse();
    // Preserve scroll position.
    const prevScrollHeight = scrollRef.current?.scrollHeight ?? 0;
    setMessages([...older, ...(messages ?? [])]);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const newScrollHeight = scrollRef.current.scrollHeight;
        scrollRef.current.scrollTop = newScrollHeight - prevScrollHeight;
      }
    });
    setHasMore(res.data.hasMore);
  }

  if (thread === undefined) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="flex-1 space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-2/3" />
          ))}
        </div>
      </div>
    );
  }

  if (thread === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={LifeBuoy}
          title={t("notFound")}
          description={t("notFoundHint")}
          action={{ href: "/messages", label: t("backToList") }}
        />
      </div>
    );
  }

  const peers = thread.participants.filter((p) => p.userId !== currentUserId);
  const threadTitle =
    peers.length === 0
      ? t("untitled")
      : peers.length === 1
        ? peerName(peers[0].user)
        : peers.map((p) => peerName(p.user)).join(", ");

  const threadTypeChip =
    thread.type === "class" ? (
      <span className="inline-flex items-center gap-1 rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-info">
        <Users className="size-3" aria-hidden />
        {t("typeClass")}
      </span>
    ) : thread.type === "school" ? (
      <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
        <School className="size-3" aria-hidden />
        {t("typeSchool")}
      </span>
    ) : thread.type === "support" ? (
      <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
        <LifeBuoy className="size-3" aria-hidden />
        {t("typeSupport")}
      </span>
    ) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        {showBackButton && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t("backToList")}
          >
            <Link href="/messages">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        )}
        <Avatar className="size-9 border border-border">
          {peers[0] && (
            <AvatarFallback className="bg-primary-500/15 text-xs font-semibold text-primary-700 dark:text-primary-400">
              {peerInitials(peers[0].user)}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold text-foreground">
              {threadTitle}
            </h2>
            {threadTypeChip}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {thread.participants.length} {t("participants")}
          </p>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="flex h-full flex-col gap-2">
          {messages === null ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-2/3" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title={t("noMessages")}
              description={t("noMessagesHint")}
            />
          ) : (
            <>
              {hasMore && (
                <div className="flex justify-center pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleLoadOlder()}
                    disabled={loadingMore}
                  >
                    {loadingMore && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    {t("loadOlder")}
                  </Button>
                </div>
              )}
              {groupMessagesByDay(messages).map((group) => (
                <div key={group.day} className="space-y-2">
                  <div className="sticky top-0 z-10 mx-auto my-2 w-fit rounded-full bg-muted px-3 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
                    {group.day}
                  </div>
                  {group.messages.map((m, idx) => {
                    const prev = group.messages[idx - 1];
                    const showSender = !prev || prev.senderId !== m.senderId;
                    return (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        isOwn={m.senderId === currentUserId}
                        showSenderName={showSender}
                        showAvatar={showSender}
                      />
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Composer */}
      <MessageInput
        threadId={threadId}
        onSent={(m) => {
          setMessages((prev) => [...(prev ?? []), m]);
        }}
      />
    </div>
  );
}
