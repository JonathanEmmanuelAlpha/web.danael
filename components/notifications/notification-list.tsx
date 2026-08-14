"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NotificationItem } from "./notification-item";
import {
  listNotificationsAction,
  markAsReadAction,
  markAllAsReadAction,
  deleteNotificationAction,
} from "@/server/actions/notifications";
import type { Notification } from "@/server/services/notifications";
import type { NotificationTypeValue } from "@/server/db/schema/enums";

export interface NotificationListProps {
  pageSize?: number;
}

const TYPE_FILTERS: { value: NotificationTypeValue; labelKey: string }[] = [
  { value: "info", labelKey: "typeInfo" },
  { value: "assignment", labelKey: "typeAssignment" },
  { value: "grade", labelKey: "typeGrade" },
  { value: "announcement", labelKey: "typeAnnouncement" },
  { value: "social", labelKey: "typeSocial" },
  { value: "reminder", labelKey: "typeReminder" },
  { value: "system", labelKey: "typeSystem" },
];

/**
 * §5.12 — Full notifications list with filter tabs (all / unread)
 * and an optional type filter.
 */
export function NotificationList({ pageSize = 30 }: NotificationListProps) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const [items, setItems] = useState<Notification[] | null>(null);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<NotificationTypeValue | "all">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listNotificationsAction({
      type: typeFilter === "all" ? undefined : typeFilter,
      read: tab === "unread" ? "unread" : undefined,
      page,
      pageSize,
    }).then((res) => {
      if (res.success) {
        setItems(res.data.items);
        setTotal(res.data.total);
      } else {
        setItems([]);
      }
    });
  }, [tab, typeFilter, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    listNotificationsAction({
      type: typeFilter === "all" ? undefined : typeFilter,
      read: tab === "unread" ? "unread" : undefined,
      page,
      pageSize,
    }).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setItems(res.data.items);
        setTotal(res.data.total);
      } else {
        setItems([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tab, typeFilter, page, pageSize]);

  async function handleMarkAsRead(id: string): Promise<void> {
    setBusy(id);
    const res = await markAsReadAction(id);
    setBusy(null);
    if (!res.success) return;
    setItems((prev) =>
      prev?.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)) ?? null,
    );
  }

  async function handleMarkAll(): Promise<void> {
    setBusy("all");
    const res = await markAllAsReadAction();
    setBusy(null);
    if (!res.success) return;
    setItems((prev) =>
      prev?.map((n) => ({ ...n, readAt: new Date() })) ?? null,
    );
  }

  async function handleDelete(id: string): Promise<void> {
    setBusy(id);
    const res = await deleteNotificationAction(id);
    setBusy(null);
    if (!res.success) return;
    setItems((prev) => prev?.filter((n) => n.id !== id) ?? null);
    setTotal((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="all">{t("all")}</TabsTrigger>
            <TabsTrigger value="unread">{t("unread")}</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Select
              value={typeFilter}
              onValueChange={(v) =>
                setTypeFilter(v as NotificationTypeValue | "all")
              }
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder={t("filterByType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon("all")}</SelectItem>
                {TYPE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {t(f.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleMarkAll()}
              disabled={busy === "all" || items?.every((n) => n.readAt) === true}
            >
              {busy === "all" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              {t("markAllAsRead")}
            </Button>
          </div>
        </div>

        <TabsContent value="all" className="mt-4">
          <NotificationListItems
            items={items}
            busy={busy}
            onMarkAsRead={handleMarkAsRead}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="unread" className="mt-4">
          <NotificationListItems
            items={items}
            busy={busy}
            onMarkAsRead={handleMarkAsRead}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {tCommon("previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {Math.ceil(total / pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            {tCommon("next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationListItems({
  items,
  busy,
  onMarkAsRead,
  onDelete,
}: {
  items: Notification[] | null;
  busy: string | null;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("Notifications");
  if (items === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title={t("empty")}
        description={t("emptyHint")}
      />
    );
  }
  return (
    <div className="space-y-2">
      {items.map((n) => (
        <div key={n.id} className="relative">
          {busy === n.id && (
            <div className="absolute right-2 top-2 z-10">
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          <NotificationItem
            notification={n}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Tree-shake friendly no-op for unused icon ── */
void Trash2;
