"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MapPin, Star, ArrowRight } from "lucide-react";
import { VerifiedBadge } from "./verified-badge";
import type { TutorListItem } from "@/server/services/tutoring";

interface TutorCardProps {
  tutor: TutorListItem;
}

function formatHourlyRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate.toLocaleString("fr-FR")} FCFA/h`;
}

function formatRating(value: number): string {
  return value.toFixed(1);
}

function initials(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim().charAt(0).toUpperCase();
  const l = (last ?? "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "?";
}

/**
 * §5.15 — Tutor search result card.
 */
export function TutorCard({ tutor }: TutorCardProps) {
  const t = useTranslations("Tutoring");
  const name =
    [tutor.firstName, tutor.lastName].filter(Boolean).join(" ") ||
    "Tuteur";

  return (
    <Card className="group flex h-full flex-col gap-4 p-5 transition hover:border-primary-500/40 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="size-12 border border-border">
          {tutor.avatarUrl ? (
            <AvatarImage src={tutor.avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback className="bg-primary-500/10 text-primary-700 dark:text-primary-400 font-semibold">
            {initials(tutor.firstName, tutor.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/tutors/${tutor.id}`}
              className="truncate font-display text-base font-semibold text-foreground hover:text-primary-700 dark:hover:text-primary-400"
            >
              {name}
            </Link>
            <VerifiedBadge verified={tutor.isVerified} />
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 text-amber-500" />
              {formatRating(tutor.ratingAvg)} ({tutor.ratingCount})
            </span>
            {tutor.location && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="size-3" />
                {tutor.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {tutor.bio && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{tutor.bio}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tutor.subjects.slice(0, 4).map((s) => (
          <Badge key={s.id} variant="brand" size="sm">
            {s.name}
          </Badge>
        ))}
        {tutor.subjects.length > 4 && (
          <Badge variant="secondary" size="sm">
            +{tutor.subjects.length - 4}
          </Badge>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("hourlyRate")}
          </p>
          <p className="font-display text-sm font-semibold text-foreground">
            {formatHourlyRate(tutor.hourlyRate)}
          </p>
        </div>
        <Link
          href={`/tutors/${tutor.id}`}
          className="inline-flex items-center gap-1 rounded-md bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-500/20 dark:text-primary-400"
        >
          {t("viewProfile")}
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </Card>
  );
}
