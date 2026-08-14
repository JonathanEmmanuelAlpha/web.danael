"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPointsAction } from "@/server/actions/gamification";
import type { UserPointsWithLevel } from "@/server/services/gamification";

/**
 * §5.8 — XP card showing the user's total XP, level and progress bar to the
 * next level (1000 XP per level).
 */
export function XpCard({ userId }: { userId: string }) {
  const t = useTranslations("Gamification");
  const [data, setData] = useState<UserPointsWithLevel | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPointsAction()
      .then((res) => {
        if (cancelled) return;
        if (res.success) setData(res.data);
        else setError(true);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) {
    return (
      <Card className="gap-0 p-5">
        <p className="text-sm text-destructive">{t("loadFailed")}</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="gap-0 p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <Skeleton className="mt-4 h-2 w-full" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="relative flex items-start justify-between gap-3 bg-gradient-to-br from-primary-500/10 via-primary-500/5 to-transparent p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("xp")}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
            {data.totalXp.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("xpToNextLevel", { count: data.xpToNextLevel })}
          </p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-700 dark:text-primary-400">
          <Zap className="size-6" aria-hidden />
        </div>
      </div>

      <div className="space-y-2 px-5 pb-5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="brand" size="lg">
              <Sparkles className="size-3" />
              {t("level")} {data.level}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {data.xpInCurrentLevel} / 1000 XP
            </span>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {data.progressPercent}%
          </span>
        </div>
        <Progress value={data.progressPercent} aria-label={t("progressToNextLevel")} />
      </div>
    </Card>
  );
}
