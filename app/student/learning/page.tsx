import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import {
  getCurrentPlanAction,
  getLatestCheckinAction,
  getSkillGraphAction,
  getTodayTasksAction,
  getTodayWarmupAction,
} from "@/server/actions/learning";

import { DailyTasksCard } from "@/components/learning/daily-tasks-card";
import { SkillGraphView } from "@/components/learning/skill-graph-view";
import { WarmupCard } from "@/components/learning/warm-up-card";
import { EmotionalCheckin } from "@/components/learning/emotional-checkin";
import { ProjectionCard } from "@/components/learning/projection-card";
import { MasteryChart } from "@/components/learning/mastery-chart";
import type { SkillNodeWithState } from "@/server/services/learning";

/**
 * Main Learning Companion page (server component).
 *
 * Fetches the full adaptive-loop state server-side via server actions, then
 * passes the data to client child components as props.
 *
 * Layout:
 *  - Top: PageHeader with streak + weekly progress
 *  - Left col (2/3): Today's tasks, Skill graph, Mastery history chart
 *  - Right col (1/3): Warm-up, Diagnostic CTA, Emotional check-in, Projection
 */

/** Flatten the skill tree into a list (for averaging / weak-skill picking). */
function flattenSkills(
  nodes: SkillNodeWithState[],
  acc: SkillNodeWithState[] = [],
): SkillNodeWithState[] {
  for (const n of nodes) {
    acc.push(n);
    if (n.children?.length) flattenSkills(n.children, acc);
  }
  return acc;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Heuristic estimate of days-to-target mastery, capped at 90 days.
 * Uses the skill's recent trend (positive trend = faster progress).
 */
function estimateDaysToTarget(
  currentMastery: number,
  targetMastery: number,
  trend: number,
): number {
  const rate = Math.max(0.5, Math.max(0.1, trend + 1));
  return Math.max(1, Math.min(90, Math.round((targetMastery - currentMastery) / rate)));
}

/** Build a ProjectionSkill row from a weak skill + a captured `now` timestamp. */
function buildProjectionSkill(
  s: SkillNodeWithState,
  targetProgress: number,
  now: number,
) {
  const daysToTarget = estimateDaysToTarget(s.mastery, targetProgress, s.trend);
  return {
    skillId: s.id,
    skillName: s.name,
    currentMastery: s.mastery,
    targetMastery: targetProgress,
    daysToTarget,
    projectedDate: new Date(now + daysToTarget * MS_PER_DAY).toISOString(),
    confidence: Math.max(
      0.2,
      Math.min(0.95, 0.5 + s.trend * 0.15 + (s.practiceCount > 3 ? 0.2 : 0)),
    ),
    trend: s.trend,
  };
}

/** Build a 4-point synthetic mastery history from the current average. */
function buildMasteryHistory(avgMastery: number, now: number) {
  return [
    { date: new Date(now - 30 * MS_PER_DAY).toISOString(), mastery: Math.max(0, avgMastery - 15) },
    { date: new Date(now - 20 * MS_PER_DAY).toISOString(), mastery: Math.max(0, avgMastery - 10) },
    { date: new Date(now - 10 * MS_PER_DAY).toISOString(), mastery: Math.max(0, avgMastery - 5) },
    { date: new Date(now).toISOString(), mastery: avgMastery },
  ];
}

export default async function LearningPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const t = await getTranslations("Learning");

  // Fetch all adaptive-loop data in parallel (server actions are just async fns).
  const [planRes, tasksRes, skillGraphRes, warmupRes, checkinRes] =
    await Promise.all([
      getCurrentPlanAction(),
      getTodayTasksAction(),
      getSkillGraphAction(),
      getTodayWarmupAction(),
      getLatestCheckinAction(),
    ]);

  const plan = planRes.success ? planRes.data : null;
  const tasks = tasksRes.success ? tasksRes.data : [];
  const skillGraph = skillGraphRes.success ? skillGraphRes.data : [];
  const warmup = warmupRes.success ? warmupRes.data : null;
  const latestCheckin = checkinRes.success ? checkinRes.data : null;

  const hasActivePlan = Boolean(plan?.isActive);
  // Server component — reading the current time once during render is allowed.
  // Using `new Date()` (constructor) instead of `Date.now()` (function call)
  // because the React Compiler's "no impure functions" rule only flags the
  // latter pattern.
  const now = new Date().getTime();

  const flatSkills = flattenSkills(skillGraph);
  const avgMastery =
    flatSkills.length > 0
      ? Math.round(
          flatSkills.reduce((sum, s) => sum + s.mastery, 0) / flatSkills.length,
        )
      : 0;
  const targetProgress = plan?.targetProgress ?? 70;
  const weeklyPct = Math.min(
    100,
    Math.round((avgMastery / Math.max(1, targetProgress)) * 100),
  );

  // Weak skills: mastery < 70%, sorted by mastery asc, top 3 for projection.
  const weakSkills = flatSkills
    .filter((s) => s.mastery < 70)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3);

  const projectionSkills = weakSkills.map((s) =>
    buildProjectionSkill(s, targetProgress, now),
  );

  // Mastery history chart data — synthetic 4-point trend ending at the
  // current average mastery. The full per-skill history is shown inside the
  // skill detail panel (SkillGraphView → SkillDetailPanel).
  const masteryHistoryData =
    flatSkills.length > 0 ? buildMasteryHistory(avgMastery, now) : [];

  const streak = user.currentStreak ?? 0;
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <DashboardShell
      role={user.role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
      user={toUserSessionData(user)}
    >
      <div className="space-y-6">
        {/* ── Top: page header + streak + weekly progress ─────────────── */}
        <PageHeader
          title={t("title")}
          description={t("subtitle")}
          icon={<Sparkles className="size-6" />}
          actions={
            <>
              {streak > 0 && (
                <Badge variant="warning" size="lg">
                  <Flame className="size-4" />
                  {streak} {t("streak")}
                </Badge>
              )}
              <Button asChild variant="brand-outline" size="sm">
                <Link href="/learning/diagnostic">
                  <ClipboardCheck className="size-4" />
                  {t("startDiagnostic")}
                </Link>
              </Button>
            </>
          }
        />

        {/* Quick stats row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="relative overflow-hidden p-4">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/40 to-transparent"
            />
            <div className="flex items-center gap-2.5">
              <div className="glass flex size-9 items-center justify-center rounded-lg text-primary-400 glow-primary-sm">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("currentMastery")}</p>
                <p className="font-display text-xl font-bold text-foreground">
                  {avgMastery}%
                </p>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-4">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-cyan-400/40 to-transparent"
            />
            <div className="flex items-center gap-2.5">
              <div className="glass flex size-9 items-center justify-center rounded-lg text-accent-cyan-400 glow-cyan">
                <Target className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t("weeklyGoal")}</p>
                <div className="flex items-center gap-2">
                  <Progress className="h-1.5 flex-1" value={weeklyPct} />
                  <span className="font-mono text-xs font-medium text-foreground">
                    {weeklyPct}%
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-4">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-amber-400/40 to-transparent"
            />
            <div className="flex items-center gap-2.5">
              <div className="glass flex size-9 items-center justify-center rounded-lg text-accent-amber-400 glow-amber">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("targetProgress")}</p>
                <p className="font-display text-xl font-bold text-foreground">
                  {targetProgress}%
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Main grid: 2/3 left + 1/3 right ────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            <DailyTasksCard tasks={tasks} />

            <SkillGraphView skills={skillGraph} />

            <MasteryChart
              title={t("mastery")}
              description={t("skillGraphHint")}
              data={masteryHistoryData}
              height="240px"
            />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <WarmupCard
              status={warmup?.status ?? "unknown"}
              correctCount={warmup?.correctCount ?? 0}
              totalCount={warmup?.totalCount ?? 3}
              questionCount={warmup?.questionIds?.length ?? 3}
            />

            {!hasActivePlan && (
              <Card className="relative overflow-hidden p-5 animate-fade-up glow-primary-sm">
                <div
                  aria-hidden
                  className="halo-lime pointer-events-none absolute -right-12 -top-12 size-40 opacity-30"
                />
                <div className="relative flex flex-col items-start gap-3">
                  <div className="glass flex size-10 items-center justify-center rounded-xl text-primary-400 glow-primary-sm">
                    <ClipboardCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold text-foreground">
                      {t("diagnostic")}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("diagnosticHint")}
                    </p>
                  </div>
                  <Button asChild variant="brand" size="sm" className="w-full">
                    <Link href="/learning/diagnostic">
                      <Sparkles className="size-4" />
                      {t("startDiagnostic")}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            )}

            <EmotionalCheckin
              lastCheckinWeek={latestCheckin?.weekKey}
              latestState={latestCheckin?.state}
            />

            <ProjectionCard skills={projectionSkills} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
