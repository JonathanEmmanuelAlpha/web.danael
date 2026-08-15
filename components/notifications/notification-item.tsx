"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Info,
  ClipboardList,
  GraduationCap,
  Megaphone,
  MessageSquare,
  Bell,
  Trophy,
  Award,
  CreditCard,
  Mail,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/server/services/notifications";
import type { NotificationTypeValue } from "@/server/db/schema/enums";

export interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const TYPE_ICON: Record<NotificationTypeValue, LucideIcon> = {
  info: Info,
  assignment: ClipboardList,
  grade: GraduationCap,
  announcement: Megaphone,
  social: MessageSquare,
  reminder: CalendarClock,
  system: Bell,
};

const TYPE_COLOR: Record<NotificationTypeValue, string> = {
  info: "bg-info/15 text-info",
  assignment: "bg-primary-500/15 text-primary-700 dark:text-primary-400",
  grade: "bg-success/15 text-success",
  announcement: "bg-warning/15 text-warning",
  social: "bg-secondary text-secondary-foreground",
  reminder: "bg-info/15 text-info",
  system: "bg-muted text-muted-foreground",
};

function formatRelative(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60_000) return "à l'instant";
  if (diff < 60 * 60 * 1000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < day)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 2 * day) return "hier";
  if (diff < 7 * day) return `il y a ${Math.floor(diff / day)} j`;
  return d.toLocaleDateString();
}

/**
 * §5.12 — Single notification item.
 *
 * - Icon by type
 * - Title, body, time, read state
 * - Optional link click-through
 * - Mark-as-read + delete actions
 */
export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const Icon = TYPE_ICON[notification.type] ?? Info;
  const isUnread = !notification.readAt;

  const content = (
    <article
      className={cn(
        "flex gap-3 rounded-xl border p-3 transition-colors",
        isUnread
          ? "border-primary-500/30 bg-primary-500/5"
          : "border-border bg-card",
      )}
      aria-live="polite"
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          TYPE_COLOR[notification.type],
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "text-sm",
              isUnread
                ? "font-semibold text-foreground"
                : "font-medium text-foreground",
            )}
          >
            {notification.title}
          </h3>
          {isUnread && (
            <span
              className="mt-1 inline-block size-2 shrink-0 rounded-full bg-primary-500"
              aria-label={t("unread")}
            />
          )}
        </div>
        {notification.body && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {notification.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">
            {formatRelative(notification.createdAt as unknown as Date)}
          </span>
          {isUnread && onMarkAsRead && (
            <button
              type="button"
              onClick={() => onMarkAsRead(notification.id)}
              className="text-[11px] font-medium text-primary-700 hover:underline dark:text-primary-400"
            >
              {t("markAsRead")}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(notification.id)}
              className="text-[11px] text-muted-foreground hover:text-destructive hover:underline"
            >
              {tCommon("delete")}
            </button>
          )}
        </div>
      </div>
    </article>
  );

  if (notification.link) {
    return (
      <Link
        href={notification.link}
        className="block hover:opacity-90"
        onClick={() => {
          if (isUnread && onMarkAsRead) onMarkAsRead(notification.id);
        }}
      >
        {content}
      </Link>
    );
  }
  return content;
}

/* -- Unused icons kept for tree-shake-friendly re-export -- */
void Trophy;
void Award;
void CreditCard;
void Mail;
