"use client";

/**
 * Projection card — "Tu maîtriseras [skill] dans ~X jours".
 *
 * For each weak skill (< 70% mastery), shows:
 *  - Skill name + current mastery
 *  - Days-to-target estimate + projected date
 *  - Confidence indicator (high / medium / low)
 *  - Encouraging message based on trend
 *
 * Glass-card surface with a primary-glow accent on the top edge and
 * animate-fade-up entry. Used in the right column of /learning.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, Target, TrendingUp, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ProjectionSkill {
  skillId: string;
  skillName: string;
  /** Current mastery (0-100). */
  currentMastery: number;
  /** Target mastery (0-100). Default 80. */
  targetMastery: number;
  /** Estimated days to reach target (0 = already reached). */
  daysToTarget: number;
  /** ISO date string of the projected completion. */
  projectedDate: string;
  /** Confidence 0-1. */
  confidence: number;
  /** Trend (positive = improving). */
  trend: number;
}

export interface ProjectionCardProps {
  skills: ProjectionSkill[];
  loading?: boolean;
  className?: string;
}

function confidenceLevel(c: number): "high" | "medium" | "low" {
  if (c >= 0.7) return "high";
  if (c >= 0.4) return "medium";
  return "low";
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const t = useTranslations("Learning");
  const variant =
    level === "high"
      ? "success"
      : level === "medium"
        ? "warning"
        : "secondary";
  const label =
    level === "high"
      ? t("projectionConfidenceHigh")
      : level === "medium"
        ? t("projectionConfidenceMedium")
        : t("projectionConfidenceLow");
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  );
}

function ProjectionRow({ skill }: { skill: ProjectionSkill }) {
  const t = useTranslations("Learning");

  const pct = Math.min(
    100,
    Math.round(
      (skill.currentMastery / Math.max(1, skill.targetMastery)) * 100,
    ),
  );
  const cLevel = confidenceLevel(skill.confidence);
  const reached = skill.currentMastery >= skill.targetMastery;
  const projectedDateLabel = reached
    ? "—"
    : new Date(skill.projectedDate).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });

  return (
    <div className="glass-card animate-fade-up rounded-lg p-4 transition-all hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-display text-sm font-semibold text-foreground truncate">
            {skill.skillName}
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("currentMastery")}:{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.round(skill.currentMastery)}%
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConfidenceBadge level={cLevel} />
        </div>
      </div>

      {/* Mastery progress bar (current vs target) */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{t("currentMastery")}</span>
          <span>
            {t("targetProgress")}: {skill.targetMastery}%
          </span>
        </div>
        <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary-400 to-accent-cyan-400 transition-all"
            style={{ width: `${pct}%` }}
          />
          {/* Target marker */}
          <div
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-accent-amber-400/80"
            style={{
              left: `${Math.min(100, skill.targetMastery)}%`,
              boxShadow: "0 0 8px rgba(251,191,36,0.6)",
            }}
          />
        </div>
      </div>

      {/* Projection summary */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {reached ? (
            <Zap className="size-3.5 text-primary-400" />
          ) : (
            <CalendarClock className="size-3.5 text-accent-cyan-400" />
          )}
          <span>
            {reached ? (
              t("projectionReached")
            ) : (
              <>
                <span className="font-mono font-semibold text-foreground">
                  ~{skill.daysToTarget}
                </span>{" "}
                {t("daysToMastery")} · {projectedDateLabel}
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <TrendingUp
            className={cn(
              "size-3",
              skill.trend >= 0 ? "text-primary-400" : "text-accent-coral-400",
            )}
          />
          <span className="font-mono">
            {skill.trend >= 0 ? "+" : ""}
            {skill.trend.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProjectionCard({
  skills,
  loading = false,
  className,
}: ProjectionCardProps) {
  const t = useTranslations("Learning");

  return (
    <Card className={cn("relative overflow-hidden p-5", className)}>
      {/* Top-edge accent */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/40 via-accent-cyan-400/20 to-transparent"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="glass flex size-9 items-center justify-center rounded-lg text-primary-400 glow-primary-sm">
            <Target className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {t("projection")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("projectionHint")}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="glass flex size-12 items-center justify-center rounded-xl text-primary-400 glow-primary-sm">
              <Zap className="size-6" aria-hidden />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("noWeakSkills")}
            </p>
            <p className="text-xs text-muted-foreground">{t("keepGoing")}</p>
          </div>
        ) : (
          skills.map((s) => <ProjectionRow key={s.skillId} skill={s} />)
        )}
      </div>
    </Card>
  );
}
