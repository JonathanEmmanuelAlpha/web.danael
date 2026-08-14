"use client";

/**
 * Daily tasks card — Aurora Navy.
 *
 * Shows today's 3 micro-tasks with:
 *  - icon by task type (practice_quiz, read_content, watch_video, …)
 *  - title + estimated minutes + skill badge
 *  - checkbox to mark complete (calls updateTaskStatusAction)
 *  - skip button (X icon)
 *  - progress: "X/3 tâches complétées"
 *
 * Completed tasks: strikethrough + green check.
 * Glass-card with glow on hover per row.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  HelpCircle,
  PlayCircle,
  Sparkles,
  Target,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { updateTaskStatusAction } from "@/server/actions/learning";
import type { PlanTaskSummary } from "@/server/services/learning";

/* ── Icon mapping ───────────────────────────────────────────── */

const TASK_TYPE_ICON: Record<string, LucideIcon> = {
  diagnostic: Target,
  practice_quiz: HelpCircle,
  read_content: BookOpen,
  watch_video: PlayCircle,
  warmup: Sparkles,
  review_weakness: TrendingUp,
  maintain_strength: Check,
  explore_new: Sparkles,
};

/**
 * Render the icon for a plan-task type.
 *
 * Uses `React.createElement` instead of `const Icon = ...; <Icon />` because
 * the React Compiler flags the latter as "creating a component during render"
 * (the local variable is mistaken for a nested component definition).
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

/* ── Sub-components ────────────────────────────────────────── */

function TaskRow({
  task,
  onComplete,
  onSkip,
}: {
  task: PlanTaskSummary;
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string) => void;
}) {
  const t = useTranslations("Learning");
  const isDone = task.status === "completed";
  const isSkipped = task.status === "skipped";
  const isInactive = isDone || isSkipped;
  const [pending, setPending] = React.useState(false);

  const handleComplete = async () => {
    setPending(true);
    onComplete(task.id);
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

  const handleSkip = async () => {
    setPending(true);
    onSkip(task.id);
    const result = await updateTaskStatusAction({
      taskId: task.id,
      status: "skipped",
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("taskSkipped"));
      return;
    }
    toast.info(t("taskSkipped"));
  };

  return (
    <div
      className={cn(
        "group glass-card flex items-start gap-3 rounded-lg p-3 transition-all",
        "hover:-translate-y-0.5 hover:border-border-strong",
        isDone && "opacity-70",
        isSkipped && "opacity-40",
      )}
    >
      {/* Checkbox / status icon */}
      <button
        type="button"
        onClick={handleComplete}
        disabled={isInactive || pending}
        aria-label={t("taskComplete")}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition-all",
          isDone
            ? "border-primary-500 bg-primary-500 text-secondary-900 shadow-[0_0_12px_-2px_rgba(147,217,26,0.6)]"
            : "border-border-strong bg-white/[0.04] hover:border-primary-500/60 hover:bg-primary-500/10",
          isSkipped && "border-accent-coral-500/50 bg-accent-coral-500/5",
          pending && "opacity-60",
        )}
      >
        {isDone ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : isSkipped ? (
          <X className="size-3.5 text-accent-coral-400" />
        ) : (
          <span className="size-2 rounded-full bg-muted-foreground/40 group-hover:bg-primary-500/60" />
        )}
      </button>

      {/* Icon + content */}
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div className="glass flex size-8 shrink-0 items-center justify-center rounded-md text-primary-400">
          <TaskTypeIcon type={task.type} className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium leading-tight text-foreground",
              isDone && "line-through decoration-primary-500/60",
              isSkipped && "line-through decoration-muted-foreground/40",
            )}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" size="sm" className="shrink-0">
              {task.estimatedMinutes} {t("min")}
            </Badge>
            {task.skillId && (
              <Badge variant="outline" size="sm" className="shrink-0">
                <Target className="size-2.5" />
                {task.type.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Skip button */}
      {!isInactive && (
        <button
          type="button"
          onClick={handleSkip}
          disabled={pending}
          aria-label={t("taskSkip")}
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent-coral-500/10 hover:text-accent-coral-400"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────────── */

export interface DailyTasksCardProps {
  tasks: PlanTaskSummary[];
  loading?: boolean;
  /** Local optimistic handlers (update the Zustand store). */
  onComplete?: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  className?: string;
}

export function DailyTasksCard({
  tasks,
  loading = false,
  onComplete,
  onSkip,
  className,
}: DailyTasksCardProps) {
  const t = useTranslations("Learning");

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length || 3;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const noop = () => {};

  return (
    <Card className={cn("relative overflow-hidden p-5 animate-fade-up", className)}>
      {/* Top-edge accent */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/40 via-accent-cyan-400/20 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="glass flex size-9 shrink-0 items-center justify-center rounded-lg text-primary-400 glow-primary-sm">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {t("todayTasks")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("todayTasksHint")}</p>
          </div>
        </div>
        <Badge variant="brand" size="sm">
          {completedCount}/{total}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{t("progress")}</span>
          <span>
            {completedCount} {t("tasksCompleted")}
          </span>
        </div>
        <Progress className="mt-1.5 h-2" value={pct} />
      </div>

      {/* Tasks list */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("todayTasksHint")}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={onComplete ?? noop}
              onSkip={onSkip ?? noop}
            />
          ))
        )}
      </div>
    </Card>
  );
}
