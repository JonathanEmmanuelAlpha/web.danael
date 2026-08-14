"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageLoader } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ChildGradesSummary } from "@/components/parent/child-grades-summary";
import { ChildAttendanceSummary } from "@/components/parent/child-attendance-summary";
import { ChildOverview } from "@/components/parent/child-overview";
import { ChildProgressTimeline } from "@/components/parent/child-progress-timeline";
import { UnlinkChildButton } from "@/components/parent/unlink-child-button";
import { Baby, CalendarX, ClipboardList, TrendingUp } from "lucide-react";
import { getChildOverviewAction } from "@/server/actions/parent";
import type { ChildOverview as ChildOverviewData } from "@/server/services/parent";

interface ChildDetailViewProps {
  studentId: string;
}

/**
 * §5.14 — Detailed parent view of a single child.
 */
export function ChildDetailView({ studentId }: ChildDetailViewProps) {
  const t = useTranslations("Parent");
  const [data, setData] = useState<ChildOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChildOverviewAction(studentId).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error?.message ?? t("loadFailed"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, t]);

  if (error) {
    return (
      <EmptyState
        icon={Baby}
        title={t("notFound")}
        description={error}
      />
    );
  }
  if (!data) {
    return <PageLoader label={t("loading")} />;
  }

  const { summary, grades, attendance, timeline } = data;
  const name =
    [summary.firstName, summary.lastName].filter(Boolean).join(" ") ||
    summary.email;

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={t("childOverviewDescription")}
        icon={<Baby className="size-6" />}
        actions={
          <UnlinkChildButton studentId={summary.id} childName={name} />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("averagePercent")}
          </p>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            {grades.averagePercent.toFixed(1)} %
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("attendanceRate")}
          </p>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            {attendance.attendanceRate.toFixed(1)} %
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("currentStreak")}
          </p>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            {summary.currentStreak} j
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("weeklyProgress")}
          </p>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            {summary.weeklyProgress} / {summary.weeklyGoal}
          </p>
        </div>
      </div>

      <SectionCard
        title={t("assignmentsAndSubmissions")}
        icon={<ClipboardList className="size-5" />}
      >
        <ChildOverview studentId={studentId} />
      </SectionCard>

      <SectionCard
        title={t("gradesSummary")}
        icon={<TrendingUp className="size-5" />}
      >
        <ChildGradesSummary data={grades} />
      </SectionCard>

      <SectionCard
        title={t("attendanceSummary")}
        icon={<CalendarX className="size-5" />}
      >
        <ChildAttendanceSummary data={attendance} />
      </SectionCard>

      <SectionCard
        title={t("recentActivity")}
        icon={<TrendingUp className="size-5" />}
      >
        <ChildProgressTimeline items={timeline} />
      </SectionCard>
    </div>
  );
}
