"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Flame,
  HelpCircle,
  PlusCircle,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTrend } from "@/components/charts/stat-trend";
import { AreaChartCard } from "@/components/charts/area-chart";
import { LineChartCard } from "@/components/charts/line-chart";
import { RadarChartCard } from "@/components/charts/radar-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  getStudentActivityTimelineAction,
  getStudentAssignmentHistoryAction,
  getStudentProgressAction,
  getStudentQuizHistoryAction,
  getStudentStreakCalendarAction,
  getStudentSubjectStatsAction,
} from "@/server/actions/analytics";
import type {
  StudentProgress,
  StudentSubjectStat,
  StudentQuizHistoryItem,
  StudentAssignmentHistoryItem,
  TimelinePoint,
  StreakDay,
} from "@/server/services/analytics";
import { LearningCompanionWidget } from "@/components/learning/learning-companion-widget";
import { useLearningEventFlusher } from "@/hooks/use-learning-event-flusher";
import { useUserStore } from "@/stores/user-store";

/**
 * §5.10 — Student dashboard with rich analytics charts.
 * Fetches all analytics client-side via server actions.
 *
 * Aurora Navy refonte:
 *  - PageHeader with glass icon + primary glow + brand-outline quick actions.
 *  - StatTrend cards in a responsive 4-col grid (already refactored).
 *  - Weekly goal + streak calendar in glass-card surfaces with primary-glow
 *    accents on active streak days.
 *  - Charts (area / radar / line) wrapped in glass-card via ChartContainer.
 *  - Recent assignments in SectionCard.
 */
export function StudentDashboard() {
  const user = useUserStore((s) => s.user);
  if (!user) return null;

  const t = useTranslations("Analytics");
  const tDash = useTranslations("Dashboard");
  const tNav = useTranslations("Navigation");

  // Ensure learning events buffered in the Zustand store are flushed on
  // tab-hide / page-unload (debounced 30s timer is handled in the store).
  useLearningEventFlusher();

  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [subjects, setSubjects] = useState<StudentSubjectStat[]>([]);
  const [quizHistory, setQuizHistory] = useState<StudentQuizHistoryItem[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<
    StudentAssignmentHistoryItem[]
  >([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [streak, setStreak] = useState<StreakDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getStudentProgressAction(),
      getStudentSubjectStatsAction(),
      getStudentQuizHistoryAction(8),
      getStudentAssignmentHistoryAction(8),
      getStudentActivityTimelineAction(30),
      getStudentStreakCalendarAction(84),
    ])
      .then(([p, s, q, a, tl, sk]) => {
        if (cancelled) return;
        if (p.success) setProgress(p.data);
        if (s.success) setSubjects(s.data);
        if (q.success) setQuizHistory(q.data);
        if (a.success) setAssignmentHistory(a.data);
        if (tl.success) setTimeline(tl.data);
        if (sk.success) setStreak(sk.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const timelineData = timeline.map((p) => ({
    date: p.date.slice(5),
    count: p.count,
  }));

  const quizLineData = quizHistory
    .filter((q) => q.completedAt)
    .reverse()
    .map((q, i) => ({
      idx: `#${i + 1}`,
      percentage: q.percentage,
    }));

  const radarData = subjects.slice(0, 8).map((s) => ({
    subject: s.subjectCode ?? s.subjectName,
    score: s.averageScore,
    completion: s.completionRate,
  }));

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={tDash("welcome", { name: user.firstName ?? user.email })}
          description={t("studentDashboardDescription")}
          icon={<TrendingUp className="size-6" />}
          actions={
            <>
              <Button asChild variant="brand-outline" size="sm">
                <Link href="/library">
                  <BookOpen className="size-4" />
                  {tNav("library")}
                </Link>
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link href="/quizzes">
                  <Sparkles className="size-4" />
                  {tNav("quizzes")}
                </Link>
              </Button>
            </>
          }
        />

        {/* Adaptive learning companion widget */}
        <LearningCompanionWidget />

        {/* XP / level / streak / quizzes row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTrend
            label={t("totalXp")}
            value={progress?.totalXp ?? 0}
            icon={Zap}
            accent="primary"
            hint={t("levelLabel", { level: progress?.level ?? 1 })}
            trend={
              progress && progress.weeklyProgress > 0
                ? (progress.weeklyProgress / Math.max(1, progress.weeklyGoal)) *
                  100
                : undefined
            }
            trendLabel={t("thisWeek")}
          />
          <StatTrend
            label={t("currentStreak")}
            value={progress?.currentStreak ?? 0}
            icon={Flame}
            accent="amber"
            hint={t("longestStreak", { count: progress?.longestStreak ?? 0 })}
          />
          <StatTrend
            label={t("completedQuizzes")}
            value={progress?.completedQuizzes ?? 0}
            icon={HelpCircle}
            accent="emerald"
            hint={t("avgQuizScore", { score: progress?.averageQuizScore ?? 0 })}
          />
          <StatTrend
            label={t("submittedAssignments")}
            value={progress?.submittedAssignments ?? 0}
            icon={ClipboardList}
            accent="blue"
            hint={t("gradedAssignments", {
              count: progress?.gradedAssignments ?? 0,
            })}
          />
        </div>

        {/* Weekly goal + streak calendar row */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Weekly goal — glass-card with primary-glow icon */}
          <div className="glass-card group relative overflow-hidden rounded-xl p-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-border-strong">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/60 to-transparent"
            />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-foreground">
                {t("weeklyGoal")}
              </h3>
              <div className="glass flex size-9 items-center justify-center rounded-lg text-primary-400 glow-primary-sm">
                <Trophy className="size-5" aria-hidden />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("weeklyProgress")}</span>
                  <span className="font-medium text-foreground">
                    {progress?.weeklyProgress ?? 0} /{" "}
                    {progress?.weeklyGoal ?? 5}
                  </span>
                </div>
                <Progress
                  className="mt-2 h-2"
                  value={
                    progress && progress.weeklyGoal > 0
                      ? Math.min(
                          100,
                          (progress.weeklyProgress / progress.weeklyGoal) * 100,
                        )
                      : 0
                  }
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("avgAssignmentScore")}</span>
                  <span className="font-medium text-foreground">
                    {progress?.averageAssignmentScore ?? 0}%
                  </span>
                </div>
                <Progress
                  className="mt-2 h-2"
                  value={progress?.averageAssignmentScore ?? 0}
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("avgQuizScoreShort")}</span>
                  <span className="font-medium text-foreground">
                    {progress?.averageQuizScore ?? 0}%
                  </span>
                </div>
                <Progress
                  className="mt-2 h-2"
                  value={progress?.averageQuizScore ?? 0}
                />
              </div>
            </div>
          </div>

          {/* Streak calendar mini-view — glass-card spanning 2 cols */}
          <div className="glass-card group relative overflow-hidden rounded-xl p-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-border-strong lg:col-span-2">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-amber-500/60 to-transparent"
            />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-foreground">
                {t("streakCalendar")}
              </h3>
              <div className="glass flex size-9 items-center justify-center rounded-lg text-accent-amber-400 glow-amber">
                <CalendarDays className="size-5" aria-hidden />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("streakCalendarHint", { days: streak.length })}
            </p>
            <div
              className="mt-4 grid grid-flow-col grid-rows-7 gap-1"
              style={{
                gridTemplateRows: "repeat(7, 1fr)",
                gridAutoColumns: "minmax(0, 1fr)",
                gridAutoFlow: "column",
              }}
            >
              {streak.map((d) => (
                <div
                  key={d.date}
                  title={d.date}
                  className={
                    d.active
                      ? "rounded-sm bg-primary-500 shadow-[0_0_8px_-2px_rgba(147,217,26,0.6)]"
                      : "rounded-sm bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]"
                  }
                  style={{ aspectRatio: "1 / 1" }}
                  aria-hidden
                />
              ))}
            </div>
          </div>
        </div>

        {/* Activity timeline */}
        <AreaChartCard
          title={t("activityTimeline")}
          description={t("activityTimelineHint")}
          data={timelineData}
          xKey="date"
          series={[{ key: "count", label: t("activities") }]}
          loading={loading}
          emptyMessage={t("noActivityYet")}
          height="240px"
        />

        {/* Subject performance radar + Recent quiz scores */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RadarChartCard
            title={t("subjectProficiency")}
            description={t("subjectProficiencyHint")}
            data={radarData}
            axisKey="subject"
            series={[
              { key: "score", label: t("avgScore") },
              { key: "completion", label: t("completion") },
            ]}
            loading={loading}
            emptyMessage={t("noSubjectData")}
          />
          <LineChartCard
            title={t("recentQuizScores")}
            description={t("recentQuizScoresHint")}
            data={quizLineData}
            xKey="idx"
            series={[{ key: "percentage", label: t("scorePercentage") }]}
            domain={[0, 100]}
            loading={loading}
            emptyMessage={t("noQuizHistory")}
          />
        </div>

        {/* Recent assignments table */}
        <SectionCard
          title={t("recentAssignments")}
          description={t("recentAssignmentsHint")}
          icon={<ClipboardList className="size-5" />}
          action={
            <Button asChild variant="brand-outline" size="sm">
              <Link href="/assignments">
                <PlusCircle className="size-4" />
                {tDash("seeAll")}
              </Link>
            </Button>
          }
        >
          {assignmentHistory.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t("noAssignmentHistory")}
              description={t("noAssignmentHistoryHint")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("assignment")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("score")}</TableHead>
                  <TableHead className="text-right">{t("date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentHistory.map((a) => (
                  <TableRow key={a.submissionId}>
                    <TableCell className="font-medium">
                      {a.assignmentTitle}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge(a.status)}>
                        {t(`status_${a.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.score != null && a.points != null
                        ? `${a.score} / ${a.points}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {a.submittedAt
                        ? new Date(a.submittedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </>
  );
}

/**
 * Map submission status → Badge variant supported by the Aurora Navy badge
 * (default/secondary/destructive/outline/success/warning/info/violet/gradient).
 * "brand" maps to "default" (primary-500/10 → primary-300), which is the
 * brand color in Aurora Navy.
 */
function statusBadge(
  status: string,
): "default" | "success" | "warning" | "info" | "secondary" {
  switch (status) {
    case "graded":
    case "returned":
      return "success";
    case "submitted":
      return "info";
    case "late":
      return "warning";
    case "not_started":
      return "secondary";
    default:
      return "default";
  }
}

void Award;
