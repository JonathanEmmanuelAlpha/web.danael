"use client";

/**
 * Daily warm-up card — Aurora Navy.
 *
 * Two states:
 *  - pending : "Warm-up du jour" + 3 question dots + "Commencer" button
 *    linking to /learning/warmup.
 *  - completed : "Warm-up complété!" + score + stars + link to redo/expand.
 *
 * Glass-card with a cyan-tinted glow when pending (call-to-action).
 */

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, Play, Sparkles, Star, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface WarmupCardProps {
  /** Warm-up status string (from WarmupSummary). Anything not "completed" is treated as pending. */
  status: "pending" | "completed" | "skipped" | "unknown" | string;
  correctCount?: number;
  totalCount?: number;
  /** Number of questions in the warm-up (default 3). */
  questionCount?: number;
  loading?: boolean;
  className?: string;
}

export function WarmupCard({
  status,
  correctCount = 0,
  totalCount = 3,
  questionCount = 3,
  loading = false,
  className,
}: WarmupCardProps) {
  const t = useTranslations("Learning");
  const isCompleted = status === "completed";
  const scorePct =
    totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5 animate-fade-up",
        // Soft cyan glow when pending to draw attention.
        !isCompleted && "glow-cyan",
        className,
      )}
    >
      {/* Top-edge accent */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r",
          isCompleted
            ? "from-primary-500/40 to-transparent"
            : "from-accent-cyan-400/60 via-primary-500/30 to-transparent",
        )}
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "glass flex size-9 shrink-0 items-center justify-center rounded-lg",
                  isCompleted
                    ? "text-primary-400 glow-primary-sm"
                    : "text-accent-cyan-400 glow-cyan",
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-5" aria-hidden />
                ) : (
                  <Zap className="size-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold text-foreground">
                  {t("warmup")}
                </h3>
                <p className="text-xs text-muted-foreground">{t("warmupHint")}</p>
              </div>
            </div>
            <Badge
              variant={isCompleted ? "success" : "info"}
              size="sm"
              className="shrink-0"
            >
              {isCompleted ? `${correctCount}/${totalCount}` : `${questionCount} ${t("questions")}`}
            </Badge>
          </div>

          {/* Body */}
          {isCompleted ? (
            <div className="mt-4 animate-fade-in">
              {/* Score bar */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("warmupScore")}</span>
                <span className="font-mono font-semibold text-foreground">
                  {scorePct}%
                </span>
              </div>
              <Progress
                className="mt-1.5 h-2"
                value={scorePct}
              />
              {/* Stars (correct count) */}
              <div className="mt-3 flex items-center gap-1">
                {Array.from({ length: totalCount }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "size-4 transition-all",
                      i < correctCount
                        ? "fill-accent-amber-400 text-accent-amber-400 shadow-[0_0_8px_-2px_rgba(251,191,36,0.6)]"
                        : "text-muted-foreground/40",
                    )}
                    aria-hidden
                  />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">
                  {t("warmupCompletedHint")}
                </span>
              </div>

              <Button
                asChild
                variant="brand-outline"
                size="sm"
                className="mt-4 w-full"
              >
                <Link href="/learning/warmup">
                  <Sparkles className="size-4" />
                  {t("viewFullPlan")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 animate-fade-in">
              {/* Question dots */}
              <div className="flex items-center gap-2">
                {Array.from({ length: questionCount }).map((_, i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="glass flex size-9 items-center justify-center rounded-lg text-accent-cyan-400"
                  >
                    <span className="font-mono text-xs font-semibold">
                      {i + 1}
                    </span>
                  </div>
                ))}
                <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span>~2 {t("min")}</span>
                </div>
              </div>

              <Button
                asChild
                variant="brand"
                size="sm"
                className="mt-4 w-full"
              >
                <Link href="/learning/warmup">
                  <Play className="size-4" />
                  {t("warmupStart")}
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
