"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/shared/loading";
import { UnreadBadge } from "@/components/messaging/unread-badge";
import {
  getUnreadCountAction,
  listNotificationsAction,
  markAsReadAction,
  markAllAsReadAction,
} from "@/server/actions/notifications";
import type { Notification } from "@/server/services/notifications";

export interface NotificationBellProps {
  /** Optional initial unread count (avoids SSR flash). */
  initialCount?: number;
}

/**
 * §5.12 — Topbar bell icon with unread count + dropdown preview.
 *
 * - Polls the unread count every 30s.
 * - Subscribes to the SSE stream for live updates.
 * - On open, fetches the latest 5 notifications.
 * - Click "mark as read" inside the dropdown updates state locally.
 */
export function NotificationBell({ initialCount = 0 }: NotificationBellProps) {
  const t = useTranslations("Notifications");
  const tNav = useTranslations("Navigation");
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [open, setOpen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refreshCount = useCallback(async () => {
    const res = await getUnreadCountAction();
    if (res.success) setCount(res.data.count);
  }, []);

  // Polling fallback (every 30s) — used in addition to SSE.
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshCount();
    }, 30_000);
    return () => clearInterval(timer);
  }, [refreshCount]);

  // Live SSE subscription.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("EventSource" in window)) return;
    try {
      const es = new EventSource("/api/notifications/sse");
      eventSourceRef.current = es;
      es.addEventListener("notification", () => {
        void refreshCount();
      });
      es.addEventListener("ping", () => {
        /* keep-alive — nothing to do */
      });
      es.onerror = () => {
        /* the browser auto-reconnects */
      };
    } catch {
      /* SSE unsupported — polling fallback handles it */
    }
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [refreshCount]);

  // Load latest 5 notifications when the dropdown opens.
  useEffect(() => {
    if (!open) return;
    listNotificationsAction({ page: 1, pageSize: 5 }).then((res) => {
      if (res.success) setItems(res.data.items);
      else setItems([]);
    });
  }, [open]);

  async function handleMarkAllRead(): Promise<void> {
    const res = await markAllAsReadAction();
    if (res.success) {
      setCount(0);
      setItems((prev) =>
        prev?.map((n) => ({ ...n, readAt: new Date() })) ?? null,
      );
    }
  }

  async function handleMarkAsRead(id: string): Promise<void> {
    const res = await markAsReadAction(id);
    if (res.success) {
      setItems((prev) =>
        prev?.map((n) =>
          n.id === id ? { ...n, readAt: new Date() } : n,
        ) ?? null,
      );
      setCount((c) => Math.max(0, c - 1));
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tNav("notifications")}
          className="relative"
        >
          <Bell className="size-5" />
          <UnreadBadge
            count={count}
            className="absolute -right-0.5 -top-0.5"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 sm:w-96"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-foreground">
            {t("title")}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => void handleMarkAllRead()}
            disabled={count === 0}
          >
            <CheckCheck className="size-3.5" />
            {t("markAllAsRead")}
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items === null ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isUnread) void handleMarkAsRead(n.id);
                      }}
                      className="block w-full px-4 py-3 text-left transition-colors hover:bg-accent/40"
                    >
                      <div className="flex items-start gap-2">
                        {isUnread && (
                          <span className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-primary-500" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs ${isUnread ? "font-semibold" : "font-medium"} text-foreground`}
                          >
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {new Date(
                              n.createdAt as unknown as Date,
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications">{t("seeAll")}</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
