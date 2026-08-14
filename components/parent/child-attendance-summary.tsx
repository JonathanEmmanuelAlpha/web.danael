"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarX, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { ChildAttendanceSummary } from "@/server/services/parent";

interface ChildAttendanceSummaryProps {
  data: ChildAttendanceSummary;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * §5.14 — Attendance rate + recent absences.
 */
export function ChildAttendanceSummary({ data }: ChildAttendanceSummaryProps) {
  const t = useTranslations("Parent");

  const rate =
    data.totalCount > 0 ? Math.round(data.attendanceRate * 10) / 10 : 100;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-success/20 bg-success/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="size-3" />
            {t("present")}
          </div>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            {data.presentCount}
          </p>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <XCircle className="size-3" />
            {t("absent")}
          </div>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            {data.absentCount}
          </p>
        </div>
        <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-warning">
            <Clock className="size-3" />
            {t("late")}
          </div>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            {data.lateCount}
          </p>
        </div>
        <div className="rounded-lg border border-info/20 bg-info/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-info">
            <CalendarX className="size-3" />
            {t("excused")}
          </div>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            {data.excusedCount}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("attendanceRate")}</span>
          <span className="font-semibold text-foreground">{rate.toFixed(1)} %</span>
        </div>
        <Progress value={rate} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {t("totalRecords", { count: data.totalCount })}
        </p>
      </div>

      {data.recentAbsences.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {t("recentAbsences")}
          </h3>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {data.recentAbsences.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {a.className ?? t("unknownClass")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.date)}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </p>
                </div>
                <Badge
                  variant={
                    a.status === "absent"
                      ? "destructive"
                      : a.status === "late"
                        ? "warning"
                        : "info"
                  }
                  size="sm"
                >
                  {t(`statusLabels.${a.status}` as const)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recentAbsences.length === 0 && data.totalCount > 0 && (
        <EmptyState
          icon={CheckCircle2}
          title={t("noAbsences")}
          description={t("noAbsencesHint")}
          className="py-6"
        />
      )}
    </div>
  );
}
