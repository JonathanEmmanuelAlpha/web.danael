"use client";

/**
 * Learning companion widget — dashboard widget for the student dashboard.
 *
 * Three states:
 *  1. No active plan  → CTA "Passer l'évaluation diagnostique" → /learning/diagnostic
 *  2. Active plan     → today's 3 micro-tasks (inline checkboxes) + progress
 *                       bar + weekly goal + "Voir le plan complet" link → /learning
 *  3. Warm-up pending → small banner "Faire le warm-up du jour" with button
 *     (rendered as an additional row inside the widget)
 *
 * Glass-card with glow-primary-sm accent and animate-fade-up entry.
 * Fetches data client-side via server actions on mount.
 */

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Flame,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLearningStore } from "@/stores/learning-store";
import {
  getCurrentPlanAction,
  getTodayTasksAction,
  getTodayWarmupAction,
  updateTaskStatusAction,
} from "@/server/actions/learning";
import type {
  LearningPlanSummary,
  PlanTaskSummary,
  WarmupSummary,
} from "@/server/services/learning";

/* -- Icon helpers --------------------------------------------- */

const TASK_TYPE_ICON: Record<string, LucideIcon> = {
  diagnostic: Target,
  practice_quiz: Zap,
  read_content: TrendingUp,
  watch_video: Play,
  warmup: Sparkles,
  review_weakness: TrendingUp,
  maintain_strength: Check,
  explore_new: Sparkles,
};

/**
 * Render the icon for a plan-task type.
 *
 * Uses `React.createElement` instead of `const Icon = ...; <Icon />` because
 * the React Compiler flags the latter as "creating a component during render".
 */
function TaskTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  return React.createElement(TASK_TYPE_ICON[type] ?? Sparkles, {
    className,
    "aria-hidden": true,
  });
}

/* -- Inline task row (compact) -------------------------------- */

function InlineTaskRow({
  task,
  onToggle,
}: {
  task: PlanTaskSummary;
  onToggle: (taskId: string, complete: boolean) => void;
}) {
  const t = useTranslations("Learning");
  const isDone = task.status === "completed";
  const isSkipped = task.status === "skipped";
  const isInactive = isDone || isSkipped;
  const [pending, setPending] = React.useState(false);

  const handleToggle = async () => {
    if (isInactive) return;
    setPending(true);
    onToggle(task.id, true);
    const result = await updateTaskStatusAction({
      taskId: task.id,
      status: "completed",
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("taskCompleted"));
      return;
    }
    toast.success(t("taskCompleted"));
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isInactive || pending}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all",
        isDone
          ? "border-primary-500/40 bg-primary-500/5"
          : isSkipped
            ? "border-accent-coral-500/30 bg-accent-coral-500/5 opacity-50"
            : "border-border bg-white/[0.02] hover:border-border-strong hover:bg-white/[0.04]",
        pending && "opacity-60",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-all",
          isDone
            ? "border-primary-500 bg-primary-500 text-secondary-900"
            : "border-border-strong bg-white/[0.04] group-hover:border-primary-500/60",
          isSkipped && "border-accent-coral-500/50 bg-accent-coral-500/10",
        )}
      >
        {isDone ? (
          <Check className="size-3" strokeWidth={3} />
        ) : isSkipped ? (
          <span className="text-[10px] text-accent-coral-400">×</span>
        ) : null}
      </span>
      <TaskTypeIcon
        type={task.type}
        className={cn(
          "size-3.5 shrink-0",
          isDone ? "text-primary-400" : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "flex-1 truncate text-xs font-medium",
          isDone
            ? "text-muted-foreground line-through decoration-primary-500/40"
            : "text-foreground",
          isSkipped && "line-through decoration-muted-foreground/40",
        )}
      >
        {task.title}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {task.estimatedMinutes}
        {t("min")}
      </span>
    </button>
  );
}

/* -- Main widget ---------------------------------------------- */

export function LearningCompanionWidget({ className }: { className?: string }) {
  const t = useTranslations("Learning");

  const [loading, setLoading] = React.useState(true);
  const [plan, setPlan] = React.useState<LearningPlanSummary | null>(null);
  const [tasks, setTasks] = React.useState<PlanTaskSummary[]>([]);
  const [warmup, setWarmup] = React.useState<WarmupSummary | null>(null);

  // Hydrate + read streak from the Zustand store (persisted).
  const streak = useLearningStore((s) => s.streak);
  const markTaskCompleted = useLearningStore((s) => s.markTaskCompleted);
  const markTaskSkipped = useLearningStore((s) => s.markTaskSkipped);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCurrentPlanAction(),
      getTodayTasksAction(),
      getTodayWarmupAction(),
    ])
      .then(([planRes, tasksRes, warmupRes]) => {
        if (cancelled) return;
        if (planRes.success) setPlan(planRes.data);
        if (tasksRes.success) setTasks(tasksRes.data);
        if (warmupRes.success) setWarmup(warmupRes.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length || 3;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const hasActivePlan = Boolean(plan?.isActive);
  const warmupPending = warmup?.status === "pending";

  // Average mastery across all skill graph entries in the store (for weekly goal).
  const skillGraph = useLearningStore((s) => s.skillGraph);
  const avgMastery =
    skillGraph.length > 0
      ? Math.round(
          skillGraph.reduce((sum, s) => sum + s.mastery, 0) / skillGraph.length,
        )
      : null;
  const targetProgress = plan?.targetProgress ?? 70;
  const weeklyPct =
    avgMastery !== null
      ? Math.min(
          100,
          Math.round((avgMastery / Math.max(1, targetProgress)) * 100),
        )
      : 0;

  const handleToggle = (taskId: string, complete: boolean) => {
    if (complete) markTaskCompleted(taskId);
    else markTaskSkipped(taskId);
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5 animate-fade-up glow-primary-sm",
        className,
      )}
    >
      {/* Decorative top-edge gradient + halo */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/60 via-accent-cyan-400/30 to-transparent"
      />
      <div
        aria-hidden
        className="halo-lime pointer-events-none absolute -right-16 -top-16 size-48 opacity-30"
      />

      {/* Header */}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="glass flex size-9 shrink-0 items-center justify-center rounded-lg text-primary-400 glow-primary-sm">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {t("companion")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("companionHint")}
            </p>
          </div>
        </div>
        {streak > 0 && (
          <Badge variant="warning" size="sm" className="shrink-0">
            <Flame className="size-3" />
            {streak} {t("streakUnit")}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="relative mt-4 space-y-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ) : !hasActivePlan ? (
        /* -- No active plan → CTA ------------------------------- */
        <div className="relative mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <div
            aria-hidden
            className="dot-grid pointer-events-none absolute inset-0 opacity-30"
          />
          <div className="relative">
            <div className="glass mx-auto flex size-12 items-center justify-center rounded-2xl text-primary-400 glow-primary">
              <Target className="size-6" aria-hidden />
            </div>
            <h4 className="mt-3 font-display text-sm font-semibold text-foreground">
              {t("noPlanYet")}
            </h4>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {t("noPlanHint")}
            </p>
            <Button asChild variant="brand" size="sm" className="mt-4">
              <Link href="/learning/diagnostic">
                <Sparkles className="size-4" />
                {t("startDiagnostic")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        /* -- Active plan → today's tasks + progress ------------ */
        <div className="relative mt-4 space-y-3">
          {/* Tasks */}
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                {t("todayTasksHint")}
              </div>
            ) : (
              tasks
                .slice(0, 3)
                .map((task) => (
                  <InlineTaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                  />
                ))
            )}
          </div>

          {/* Today's progress */}
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{t("todayTasks")}</span>
              <span className="font-mono">
                {completedCount}/{total} {t("tasksCompleted")}
              </span>
            </div>
            <Progress className="mt-1.5 h-1.5" value={pct} />
          </div>

          {/* Weekly goal */}
          {avgMastery !== null && (
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{t("weeklyGoal")}</span>
                <span className="font-mono">
                  {avgMastery}% / {targetProgress}%
                </span>
              </div>
              <Progress className="mt-1.5 h-1.5" value={weeklyPct} />
            </div>
          )}

          {/* Warm-up banner (if pending) */}
          {warmupPending && (
            <div className="flex items-center gap-2 rounded-lg border border-accent-cyan-500/30 bg-accent-cyan-500/5 p-2.5">
              <div className="glass flex size-7 shrink-0 items-center justify-center rounded-md text-accent-cyan-400 glow-cyan">
                <Zap className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  {t("warmup")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("warmupHint")}
                </p>
              </div>
              <Button asChild variant="cyan" size="sm" className="shrink-0">
                <Link href="/learning/warmup">
                  <Play className="size-3.5" />
                  {t("warmupStart")}
                </Link>
              </Button>
            </div>
          )}

          {/* View full plan CTA */}
          <Button asChild variant="brand-outline" size="sm" className="w-full">
            <Link href="/learning">
              {t("viewFullPlan")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </Card>
  );
}
