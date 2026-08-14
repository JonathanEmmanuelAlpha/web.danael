"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  PlusCircle,
  School,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTrend } from "@/components/charts/stat-trend";
import { BarChartCard } from "@/components/charts/bar-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  getTeacherAssignmentStatsAction,
  getTeacherClassStatsAction,
  getTeacherOverviewAction,
  getTeacherStudentPerformanceAction,
} from "@/server/actions/analytics";
import type {
  TeacherOverview,
  TeacherClassStat,
  TeacherAssignmentStat,
  TeacherStudentNeedingAttention,
} from "@/server/services/analytics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { User } from "@/server/db/schema/users";
import type { UserRole } from "@/types";
import { useUserStore } from "@/stores/user-store";

/**
 * §5.9 — Teacher dashboard with rich analytics charts.
 *
 * Aurora Navy refonte:
 *  - PageHeader with brand-outline + brand quick actions (new assignment / quiz).
 *  - StatTrend cards in a 4-col responsive grid (already refactored).
 *  - Two BarChartCards (class comparison + assignment submission rates) wrapped
 *    in glass-card via ChartContainer.
 *  - "Students needing attention" list rendered as animated glass rows with
 *    staggered `animate-fade-up`.
 *  - Recent submissions table inside a SectionCard.
 */
export function TeacherDashboard() {
  const { user } = useUserStore();
  if (!user) return null;

  const t = useTranslations("Analytics");
  const tDash = useTranslations("Dashboard");
  const tNav = useTranslations("Navigation");
  const role = user.role as UserRole;
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [classStats, setClassStats] = useState<TeacherClassStat[]>([]);
  const [assignmentStats, setAssignmentStats] = useState<
    TeacherAssignmentStat[]
  >([]);
  const [studentsAttention, setStudentsAttention] = useState<
    TeacherStudentNeedingAttention[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getTeacherOverviewAction(),
      getTeacherClassStatsAction(),
      getTeacherAssignmentStatsAction(),
      getTeacherStudentPerformanceAction(),
    ])
      .then(([o, c, a, s]) => {
        if (cancelled) return;
        if (o.success) setOverview(o.data);
        if (c.success) setClassStats(c.data);
        if (a.success) setAssignmentStats(a.data);
        if (s.success) setStudentsAttention(s.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const classComparisonData = classStats.map((c) => ({
    name: c.className,
    score: c.averageScore,
    completion: c.completionRate,
  }));

  const assignmentSubData = assignmentStats.slice(0, 10).map((a) => ({
    name: a.title.length > 24 ? `${a.title.slice(0, 22)}…` : a.title,
    submissionRate: a.submissionRate,
    averageScore: a.averageScore,
  }));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={tDash("welcome", { name: user.firstName ?? user.email })}
          description={t("teacherDashboardDescription")}
          icon={<TrendingUp className="size-6" />}
          actions={
            <>
              <Button asChild variant="brand-outline" size="sm">
                <Link href="/teacher-assignments">
                  <PlusCircle className="size-4" />
                  {t("assignmentsCreated")}
                </Link>
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link href="/teacher-quizzes">
                  <Sparkles className="size-4" />
                  {tNav("quizzes")}
                </Link>
              </Button>
            </>
          }
        />

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTrend
            label={t("classesCount")}
            value={overview?.classesCount ?? 0}
            icon={School}
            accent="primary"
            hint={t("classesCountHint")}
          />
          <StatTrend
            label={t("studentsCount")}
            value={overview?.studentsCount ?? 0}
            icon={Users}
            accent="emerald"
            hint={t("studentsCountHint")}
          />
          <StatTrend
            label={t("assignmentsCreated")}
            value={overview?.assignmentsCount ?? 0}
            icon={ClipboardList}
            accent="amber"
            hint={t("quizzesCreated", { count: overview?.quizzesCount ?? 0 })}
          />
          <StatTrend
            label={t("avgClassPerformance")}
            value={`${overview?.averageClassPerformance ?? 0}%`}
            icon={TrendingUp}
            accent="blue"
            hint={t("avgClassPerformanceHint")}
          />
        </div>

        {/* Class comparison bar chart */}
        <BarChartCard
          title={t("classComparison")}
          description={t("classComparisonHint")}
          data={classComparisonData}
          xKey="name"
          series={[
            { key: "score", label: t("avgScore"), color: "#93d91a" },
            { key: "completion", label: t("completion"), color: "#fbbf24" },
          ]}
          loading={loading}
          emptyMessage={t("noClassData")}
          height="280px"
        />

        {/* Assignment submission rates + Students needing attention */}
        <div className="grid gap-4 lg:grid-cols-2">
          <BarChartCard
            title={t("assignmentSubmissionRates")}
            description={t("assignmentSubmissionRatesHint")}
            data={assignmentSubData}
            xKey="name"
            series={[
              {
                key: "submissionRate",
                label: t("submissionRate"),
                color: "#22d3ee",
              },
              { key: "averageScore", label: t("avgScore"), color: "#a78bfa" },
            ]}
            loading={loading}
            emptyMessage={t("noAssignmentData")}
            height="260px"
          />
          <SectionCard
            title={t("studentsNeedingAttention")}
            description={t("studentsNeedingAttentionHint")}
            icon={<AlertTriangle className="size-5" />}
          >
            {studentsAttention.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("noStudentsNeedingAttention")}
                description={t("noStudentsNeedingAttentionHint")}
              />
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                {studentsAttention.map((s, idx) => (
                  <li
                    key={s.studentId}
                    className="animate-fade-up flex items-center justify-between gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2 transition-colors hover:bg-white/[0.04]"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9 ring-1 ring-inset ring-border-strong">
                        {s.avatarUrl && (
                          <AvatarImage src={s.avatarUrl} alt="" />
                        )}
                        <AvatarFallback className="bg-primary-500/10 text-xs font-semibold text-primary-400">
                          {s.studentName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {s.studentName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t("missingAssignments", { count: s.missingCount })} ·{" "}
                          {t("lateSubmissions", { count: s.lateCount })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={s.averageScore < 50 ? "destructive" : "warning"}
                    >
                      {s.averageScore}%
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Recent submissions table */}
        <SectionCard
          title={t("recentSubmissions")}
          description={t("recentSubmissionsHint")}
          icon={<ClipboardList className="size-5" />}
          action={
            <Button asChild variant="brand-outline" size="sm">
              <Link href="/teacher-assignments">
                <PlusCircle className="size-4" />
                {tDash("seeAll")}
              </Link>
            </Button>
          }
        >
          {assignmentStats.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t("noSubmissionsYet")}
              description={t("noSubmissionsYetHint")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("assignment")}</TableHead>
                  <TableHead className="text-right">
                    {t("submissions")}
                  </TableHead>
                  <TableHead className="text-right">{t("graded")}</TableHead>
                  <TableHead className="text-right">
                    {t("submissionRate")}
                  </TableHead>
                  <TableHead className="text-right">{t("avgScore")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentStats.slice(0, 10).map((a) => (
                  <TableRow key={a.assignmentId}>
                    <TableCell className="max-w-[260px] truncate font-medium">
                      {a.title}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.submissionsCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.gradedCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.submissionRate}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.averageScore}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </DashboardShell>
  );
}

void GraduationCap;
void HelpCircle;
