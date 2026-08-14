"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Award } from "lucide-react";
import { BadgeCard } from "./badge-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getBadgesAction } from "@/server/actions/gamification";
import type { BadgeWithEarned } from "@/server/services/gamification";

/**
 * §5.8 — Grid of all badges (earned + locked). Earned badges appear first,
 * sorted by earnedAt desc, then by category.
 */
export function BadgeGrid({ userId }: { userId: string }) {
  const t = useTranslations("Gamification");
  const [items, setItems] = useState<BadgeWithEarned[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBadgesAction()
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          const sorted = [...res.data].sort((a, b) => {
            if (a.earned !== b.earned) return a.earned ? -1 : 1;
            if (a.earned && a.earnedAt && b.earnedAt) {
              return b.earnedAt.getTime() - a.earnedAt.getTime();
            }
            return a.category.localeCompare(b.category);
          });
          setItems(sorted);
        } else {
          setError(true);
        }
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) {
    return (
      <EmptyState
        icon={Award}
        title={t("loadFailed")}
        description={t("loadFailedHint")}
      />
    );
  }

  if (!items) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title={t("noBadges")}
        description={t("noBadgesHint")}
      />
    );
  }

  const earnedCount = items.filter((b) => b.earned).length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t("badgesProgress", { earned: earnedCount, total: items.length })}
      </p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((b) => (
          <li key={b.id}>
            <BadgeCard badge={b} />
          </li>
        ))}
      </ul>
    </div>
  );
}
