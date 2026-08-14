"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Award,
  BookOpen,
  ClipboardList,
  HelpCircle,
  LogIn,
  MessageSquare,
  Star,
  Download,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge as UIBadge } from "@/components/ui/badge";
import { getActivitiesAction } from "@/server/actions/gamification";
import type { ActivityWithMeta } from "@/server/services/gamification";
import type { ActivityTypeValue } from "@/server/db/schema/enums";

const ACTIVITY_ICON: Partial<Record<ActivityTypeValue, typeof Activity>> = {
  view_content: BookOpen,
  download_content: Download,
  submit_assignment: ClipboardList,
  complete_quiz: HelpCircle,
  earn_badge: Award,
  join_class: LogIn,
  post_message: MessageSquare,
  rate_content: Star,
};

const ACTIVITY_BADGE_STYLES: Partial<Record<ActivityTypeValue, string>> = {
  view_content: "bg-info/15 text-info",
  download_content: "bg-info/15 text-info",
  submit_assignment: "bg-warning/15 text-warning",
  complete_quiz: "bg-primary-500/15 text-primary-700 dark:text-primary-400",
  earn_badge: "bg-primary-500/15 text-primary-700 dark:text-primary-400",
  join_class: "bg-success/15 text-success",
  post_message: "bg-info/15 text-info",
  rate_content: "bg-warning/15 text-warning",
};

export function ActivityFeed({
  userId,
  limit = 15,
}: {
  userId: string;
  limit?: number;
}) {
  const t = useTranslations("Gamification");
  const [items, setItems] = useState<ActivityWithMeta[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getActivitiesAction(limit)
      .then((res) => {
        if (cancelled) return;
        if (res.success) setItems(res.data);
        else setError(true);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  if (error) {
    return (
      <EmptyState
        icon={Activity}
        title={t("loadFailed")}
        description={t("loadFailedHint")}
      />
    );
  }

  if (!items) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={t("noActivities")}
        description={t("noActivitiesHint")}
      />
    );
  }

  return (
    <ol className="relative space-y-1">
      {items.map((a, idx) => {
        const Icon = ACTIVITY_ICON[a.activityType] ?? Activity;
        const badgeClass =
          ACTIVITY_BADGE_STYLES[a.activityType] ?? "bg-info/15 text-info";
        const isLast = idx === items.length - 1;
        return (
          <li key={a.id} className="relative flex gap-3 pb-3">
            {!isLast ? (
              <span
                className="absolute left-[14px] top-7 bottom-0 w-px bg-border"
                aria-hidden
              />
            ) : null}
            <span
              className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ${badgeClass}`}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-foreground">
                  {t(`activityTypes.${a.activityType}`)}
                </span>
                <UIBadge variant="outline" size="sm">
                  {a.entityType}
                </UIBadge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRelative(a.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
