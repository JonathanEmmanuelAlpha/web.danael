"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Clock,
  Star,
  Target,
  Trophy,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  startChallengeAction,
  submitChallengeAction,
} from "@/server/actions/talent";
import type { TalentChallengeWithRelations } from "@/server/services/talent";

const TIER_COLORS: Record<string, string> = {
  seedling: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
  bronze: "from-amber-600/10 to-amber-600/5 border-amber-600/20",
  silver: "from-slate-400/10 to-slate-400/5 border-slate-400/20",
  gold: "from-yellow-500/10 to-yellow-500/5 border-yellow-500/20",
  diamond:
    "from-cyan-400/10 to-cyan-400/5 border-cyan-400/20",
};

const TIER_ICONS: Record<string, string> = {
  seedling: "🌱",
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  diamond: "💎",
};

export interface TalentChallengeCardProps {
  challenge: TalentChallengeWithRelations;
  /** Submission status if the student already started. */
  submissionStatus?: "in_progress" | "submitted" | "reviewed" | "rejected";
  onStarted?: (submissionId: string) => void;
}

export function TalentChallengeCard({
  challenge,
  submissionStatus,
  onStarted,
}: TalentChallengeCardProps) {
  const t = useTranslations("Talent");
  const [loading, setLoading] = useState(false);
  const tierColor =
    TIER_COLORS[challenge.requiredTier] ?? TIER_COLORS.seedling;

  async function handleStart() {
    setLoading(true);
    const res = await startChallengeAction({ challengeId: challenge.id });
    setLoading(false);
    if (res.success) {
      toast.success(t("challengeStarted"));
      onStarted?.(res.data.id);
    } else {
      toast.error(res.error?.message ?? t("challengeStartFailed"));
    }
  }

  const isCompleted = submissionStatus === "submitted" || submissionStatus === "reviewed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`relative overflow-hidden bg-gradient-to-br ${tierColor} p-5 transition-all hover:shadow-lg`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">
                {TIER_ICONS[challenge.requiredTier] ?? "🎯"}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {t(`type.${challenge.type}`)}
              </Badge>
              {isCompleted && (
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                >
                  <CheckCircle2 className="size-3" />
                  {t("completed")}
                </Badge>
              )}
            </div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {challenge.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {challenge.description}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="size-3" />
              {challenge.difficulty}/10
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {challenge.estimatedMinutes} min
          </span>
          {challenge.ratingCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 text-amber-500" />
              {challenge.ratingAvg.toFixed(1)} ({challenge.ratingCount})
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Trophy className="size-3" />
            {challenge.completionsCount} {t("completions")}
          </span>
        </div>

        {challenge.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {challenge.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {isCompleted ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/student/talent/challenges/${challenge.id}`}>
                {t("viewSubmission")}
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          ) : submissionStatus === "in_progress" ? (
            <Button variant="brand" size="sm" asChild>
              <Link href={`/student/talent/challenges/${challenge.id}`}>
                {t("resume")}
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <Button
              variant="brand"
              size="sm"
              disabled={loading}
              onClick={handleStart}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Target className="size-3.5" />
              )}
              {t("startChallenge")}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
