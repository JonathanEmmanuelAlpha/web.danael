"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity, BookOpen, CalendarClock, CheckCircle2 } from "lucide-react";
import type { ChildTimelineItem } from "@/server/services/parent";

interface ChildProgressTimelineProps {
  items: ChildTimelineItem[];
  limit?: number;
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTIVITY_ICON: Record<string, typeof Activity> = {
  view_content: BookOpen,
  download_content: BookOpen,
  submit_assignment: CheckCircle2,
  complete_quiz: CheckCircle2,
  earn_badge: Activity,
  join_class: Activity,
  post_message: Activity,
  rate_content: Activity,
};

/**
 * §5.14 — Activity timeline for a child.
 */
export function ChildProgressTimeline({
  items,
  limit = 20,
}: ChildProgressTimelineProps) {
  const t = useTranslations("Parent");
  const slice = items.slice(0, limit);

  if (slice.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={t("noActivity")}
        description={t("noActivityHint")}
      />
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {slice.map((item) => {
        const Icon = ACTIVITY_ICON[item.activityType] ?? Activity;
        return (
          <li key={item.id} className="relative">
            <span className="absolute -left-[26px] flex size-5 items-center justify-center rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400">
              <Icon className="size-3" />
            </span>
            <div className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {t(`activityLabels.${item.activityType}` as const)}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("entityType")}:{" "}
                <Badge variant="outline" size="sm">
                  {item.entityType}
                </Badge>
              </p>
            </div>
          </li>
        );
      })}
      <li className="relative">
        <span className="absolute -left-[26px] flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarClock className="size-3" />
        </span>
        <p className="text-xs text-muted-foreground">{t("timelineEnd")}</p>
      </li>
    </ol>
  );
}
