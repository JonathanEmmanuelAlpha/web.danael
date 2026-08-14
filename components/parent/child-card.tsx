"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Calendar, Flame, GraduationCap, TrendingUp } from "lucide-react";
import type { ChildSummary } from "@/server/services/parent";

interface ChildCardProps {
  child: ChildSummary;
}

function initials(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim().charAt(0).toUpperCase();
  const l = (last ?? "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "?";
}

/**
 * §5.14 — Child summary card shown on the parent dashboard & children list.
 */
export function ChildCard({ child }: ChildCardProps) {
  const t = useTranslations("Parent");
  const name =
    [child.firstName, child.lastName].filter(Boolean).join(" ") || child.email;

  const weeklyPct =
    child.weeklyGoal > 0
      ? Math.min(100, Math.round((child.weeklyProgress / child.weeklyGoal) * 100))
      : 0;

  return (
    <Card className="group flex h-full flex-col gap-4 p-5 transition hover:border-primary-500/40 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="size-12 border border-border">
          {child.avatarUrl ? (
            <AvatarImage src={child.avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback className="bg-primary-500/10 text-primary-700 dark:text-primary-400 font-semibold">
            {initials(child.firstName, child.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Link
            href={`/children/${child.id}`}
            className="truncate font-display text-base font-semibold text-foreground hover:text-primary-700 dark:hover:text-primary-400"
          >
            {name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {child.level && (
              <Badge variant="brand" size="sm">
                <GraduationCap className="size-3" />
                {child.level}
                {child.series ? ` · ${child.series}` : ""}
              </Badge>
            )}
            {child.className && (
              <span className="inline-flex items-center gap-1 truncate">
                <Calendar className="size-3" />
                {child.className}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="size-3 text-amber-500" />
            {t("currentStreak")}
          </div>
          <p className="mt-0.5 font-display text-lg font-bold text-foreground">
            {child.currentStreak}
            <span className="ml-1 text-xs font-normal text-muted-foreground">j</span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="size-3 text-primary-600" />
            {t("weeklyProgress")}
          </div>
          <p className="mt-0.5 font-display text-lg font-bold text-foreground">
            {child.weeklyProgress}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              / {child.weeklyGoal}
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <Progress value={weeklyPct} className="h-1.5" />
        <p className="text-[10px] text-muted-foreground">
          {t("weeklyGoalProgress", { pct: weeklyPct })}
        </p>
      </div>

      <div className="mt-auto pt-1">
        <Button asChild variant="ghost" size="sm" className="w-full justify-between">
          <Link href={`/children/${child.id}`}>
            {t("viewDetails")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
