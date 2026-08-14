"use client";

import { useTranslations } from "next-intl";
import { Lock, CheckCircle2, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BadgeWithEarned } from "@/server/services/gamification";

const CATEGORY_COLORS: Record<string, string> = {
  quiz: "from-info/15 via-info/5 to-transparent text-info",
  content: "from-emerald-500/15 via-emerald-500/5 to-transparent text-emerald-600 dark:text-emerald-400",
  assignment: "from-amber-500/15 via-amber-500/5 to-transparent text-amber-600 dark:text-amber-400",
  streak: "from-rose-500/15 via-rose-500/5 to-transparent text-rose-600 dark:text-rose-400",
  goal: "from-primary-500/15 via-primary-500/5 to-transparent text-primary-700 dark:text-primary-400",
};

export interface BadgeCardProps {
  badge: BadgeWithEarned;
  className?: string;
}

/**
 * §5.8 — Single badge card.
 *
 * Earned badges show a colored gradient + check icon.
 * Locked badges show a grayscale lock with the badge's name + description.
 */
export function BadgeCard({ badge, className }: BadgeCardProps) {
  const t = useTranslations("Gamification");
  const earned = badge.earned;
  const colorClasses = CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.goal;

  return (
    <Card
      className={cn(
        "group relative h-full overflow-hidden p-0 transition",
        earned ? "hover:shadow-md" : "opacity-80",
        className,
      )}
    >
      <div
        className={cn(
          "flex aspect-square items-center justify-center bg-gradient-to-br",
          earned ? colorClasses : "from-muted/50 via-muted/20 to-transparent text-muted-foreground grayscale",
        )}
      >
        {earned ? (
          <Award className="size-12" aria-hidden />
        ) : (
          <Lock className="size-10" aria-hidden />
        )}
      </div>

      <div className="space-y-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-display text-sm font-semibold text-foreground">
            {badge.name}
          </h3>
          {earned ? (
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          ) : null}
        </div>
        {badge.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {badge.description}
          </p>
        ) : null}
        <div className="flex items-center gap-1.5 pt-1">
          <Badge variant={earned ? "brand" : "outline"} size="sm">
            {earned ? t("earned") : t("locked")}
          </Badge>
          {badge.xpReward > 0 ? (
            <Badge variant="secondary" size="sm">
              +{badge.xpReward} XP
            </Badge>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
