"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Flame, Snowflake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  freezeStreakAction,
  getStreakAction,
} from "@/server/actions/gamification";
import type { StreakInfo } from "@/server/services/gamification";
import { MAX_STREAK_FREEZES_PER_WEEK } from "@/server/services/gamification";

/**
 * §5.8 — Streak card: current streak (with flame icon), longest streak, and a
 * "Freeze streak" button (max 2 freezes per rolling 7-day window).
 */
export function StreakCard({ userId }: { userId: string }) {
  const t = useTranslations("Gamification");
  const [data, setData] = useState<StreakInfo | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStreakAction()
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

  async function handleFreeze() {
    setPending(true);
    const res = await freezeStreakAction();
    setPending(false);
    if (res.success) {
      setData(res.data);
      toast.success(t("freezeUsed"));
    } else {
      toast.error(res.error.message ?? t("freezeFailed"));
    }
  }

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
      </Card>
    );
  }

  const freezePercent =
    (data.freezesUsedThisWeek / MAX_STREAK_FREEZES_PER_WEEK) * 100;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="relative flex items-start justify-between gap-3 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("currentStreak")}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              {data.currentStreak}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {t("days")}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("longestStreak")}: <span className="font-semibold">{data.longestStreak} {t("days")}</span>
            {data.activeToday ? (
              <span className="ml-2 inline-flex items-center gap-1 text-success">
                · {t("activeToday")}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-500">
          <Flame className="size-6" aria-hidden />
        </div>
      </div>

      <div className="space-y-3 px-5 pb-5 pt-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Snowflake className="size-3" aria-hidden />
              {t("streakFreeze")}
            </span>
            <span>
              {data.freezesUsedThisWeek} / {MAX_STREAK_FREEZES_PER_WEEK}
            </span>
          </div>
          <Progress value={freezePercent} aria-label={t("streakFreezeUsed")} />
        </div>
        <Button
          variant="brand-outline"
          size="sm"
          className="w-full"
          disabled={pending || data.freezesRemaining === 0}
          onClick={handleFreeze}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Snowflake className="size-4" />
          )}
          {data.freezesRemaining > 0
            ? t("useFreeze", { count: data.freezesRemaining })
            : t("noFreezeLeft")}
        </Button>
      </div>
    </Card>
  );
}
