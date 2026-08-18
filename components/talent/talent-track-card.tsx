"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Clock,
  Target,
  Trophy,
  Flame,
  Loader2,
  AlertTriangle,
  PauseCircle,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TalentTrackWithRelations } from "@/server/services/talent";

export interface TalentTrackCardProps {
  track: TalentTrackWithRelations | null;
  onGenerate?: () => void;
  generating?: boolean;
}

export function TalentTrackCard({
  track,
  onGenerate,
  generating,
}: TalentTrackCardProps) {
  const t = useTranslations("Talent");

  if (!track) {
    return (
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400">
            <Sparkles className="size-6" />
          </div>
          <h3 className="font-display text-base font-semibold">
            {t("noTrackYet")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("noTrackYetDesc")}
          </p>
          <Button
            variant="brand"
            onClick={onGenerate}
            disabled={generating}
            className="mt-2"
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {t("generateTrack")}
          </Button>
        </div>
      </Card>
    );
  }

  const completedCount = track.progress.filter(
    (p) => p.status === "submitted" || p.status === "reviewed",
  ).length;
  const totalCount = track.challenges.length;
  const completionPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Target className="size-3.5" />
              {t("weeklyTalentTrack")}
            </div>
            <h3 className="mt-1 font-display text-xl font-bold">
              {t("trackForWeek", { week: track.weekKey })}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3" />
                {track.northStar?.name ?? "—"}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />
                {track.timeBudgetMinutes} min
              </Badge>
            </div>
          </div>
          {track.isPaused && (
            <Badge
              variant="warning"
              className="gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            >
              <PauseCircle className="size-3.5" />
              {t("paused")}
            </Badge>
          )}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("challengesCompleted", { done: completedCount, total: totalCount })}
            </span>
            <span>{Math.round(completionPct)}%</span>
          </div>
          <Progress value={completionPct} className="h-1.5" />
        </div>

        {/* Challenges list */}
        <div className="space-y-2">
          {track.challenges.map((challenge, idx) => {
            const progress = track.progress.find(
              (p) => p.challengeId === challenge.id,
            );
            const isCompleted =
              progress?.status === "submitted" || progress?.status === "reviewed";
            return (
              <Link
                key={challenge.id}
                href={`/student/talent/challenges/${challenge.id}`}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3 transition-colors hover:bg-muted/30"
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isCompleted
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                  }`}
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {challenge.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {challenge.estimatedMinutes} min · {t(`type.${challenge.type}`)}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        {track.isPaused && track.pauseReason && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{track.pauseReason}</span>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
