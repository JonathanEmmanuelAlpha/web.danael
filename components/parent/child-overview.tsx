"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import { CalendarClock, CheckCircle2, ClipboardList } from "lucide-react";
import { getChildAssignmentsAction } from "@/server/actions/parent";
import type { ChildAssignmentsSummary } from "@/server/services/parent";

interface ChildOverviewProps {
  studentId: string;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusVariant(status: string) {
  switch (status) {
    case "graded":
    case "returned":
      return "success" as const;
    case "submitted":
    case "late":
      return "info" as const;
    default:
      return "secondary" as const;
  }
}

/**
 * §5.14 — Detailed child overview (assignments tab) shown on the child detail page.
 */
export function ChildOverview({ studentId }: ChildOverviewProps) {
  const t = useTranslations("Parent");
  const [data, setData] = useState<ChildAssignmentsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChildAssignmentsAction(studentId).then((res) => {
      if (cancelled) return;
      setData(res.success ? res.data : { upcoming: [], recent: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (data === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">
          <CalendarClock className="size-3.5" />
          {t("upcomingAssignments")} ({data.upcoming.length})
        </TabsTrigger>
        <TabsTrigger value="recent">
          <CheckCircle2 className="size-3.5" />
          {t("recentSubmissions")} ({data.recent.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming" className="mt-3">
        {data.upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t("noUpcoming")}
            description={t("noUpcomingHint")}
          />
        ) : (
          <ul className="space-y-2">
            {data.upcoming.map((a) => (
              <li
                key={a.assignmentId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {a.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.subjectName ?? "—"} · {t("dueOn", { date: formatDate(a.dueAt) })}
                  </p>
                </div>
                <Badge variant="warning" size="sm">
                  {t("toDo")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="recent" className="mt-3">
        {data.recent.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t("noRecentSubmissions")}
            description={t("noRecentSubmissionsHint")}
          />
        ) : (
          <ul className="space-y-2">
            {data.recent.map((a) => (
              <li
                key={a.assignmentId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {a.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.subjectName ?? "—"}
                    {a.gradedAt
                      ? ` · ${t("gradedOn", { date: formatDate(a.gradedAt) })}`
                      : a.submittedAt
                        ? ` · ${t("submittedOn", { date: formatDate(a.submittedAt) })}`
                        : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {a.score !== null && a.points !== null && (
                    <Badge variant="success" size="sm">
                      {Number(a.score).toFixed(2)} / {a.points}
                    </Badge>
                  )}
                  <Badge variant={statusVariant(a.status)} size="sm">
                    {t(`submissionStatus.${a.status}` as const)}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
