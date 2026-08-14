"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  Trophy,
  Users,
  Gift,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompetitionListItem } from "@/server/services/competitions";
import type {
  CompetitionScopeValue,
  CompetitionStatusValue,
} from "@/server/db/schema/enums";

const SCOPE_VARIANT: Record<
  CompetitionScopeValue,
  "outline" | "secondary" | "info" | "brand"
> = {
  class: "outline",
  school: "secondary",
  regional: "info",
  national: "brand",
};

const STATUS_VARIANT: Record<
  CompetitionStatusValue,
  "outline" | "info" | "success" | "warning" | "secondary"
> = {
  draft: "outline",
  scheduled: "info",
  active: "success",
  ended: "secondary",
  cancelled: "warning",
};

export interface CompetitionCardProps {
  competition: CompetitionListItem;
  href?: string;
  variant?: "student" | "teacher";
}

export function CompetitionCard({
  competition,
  href,
  variant = "student",
}: CompetitionCardProps) {
  const t = useTranslations("Competitions");

  const detailHref = href ?? `/${variant === "teacher" ? "teacher-competitions" : "competitions"}/${competition.id}`;
  const scope = competition.scope as CompetitionScopeValue;
  const status = competition.status as CompetitionStatusValue;

  const now = new Date();
  const isActive =
    competition.status === "active" &&
    now >= competition.startAt &&
    now <= competition.endAt;
  const hasEnded = now > competition.endAt || competition.status === "ended";

  return (
    <Card className="group flex h-full flex-col gap-3 p-5 transition hover:border-primary-500/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-display text-base font-semibold text-foreground">
            {competition.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={SCOPE_VARIANT[scope]} size="sm">
              {t(`scope.${scope}`)}
            </Badge>
            <Badge variant={STATUS_VARIANT[status]} size="sm">
              {t(`status.${status}`)}
            </Badge>
          </div>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
          <Trophy className="size-5" aria-hidden />
        </div>
      </div>

      {competition.description ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {competition.description}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" aria-hidden />
          {isActive
            ? t("endsOn", { date: formatDate(competition.endAt) })
            : hasEnded
              ? t("endedOn", { date: formatDate(competition.endAt) })
              : t("startsOn", { date: formatDate(competition.startAt) })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" aria-hidden />
          {t("participants", { count: competition.participantsCount })}
        </span>
        {competition.prizeDescription ? (
          <span className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-400">
            <Gift className="size-3.5" aria-hidden />
            {t("prize")}
          </span>
        ) : null}
      </div>

      <div className="mt-auto pt-2">
        <Button asChild variant="brand" size="sm" className="w-full justify-between">
          <Link href={detailHref}>
            {isActive ? t("viewCompetition") : t("viewDetails")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
