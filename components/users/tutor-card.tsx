"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Calendar,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startConversationAction } from "@/server/actions/messaging";
import type { TutorCardData } from "@/server/actions/users";

interface TutorCardProps {
  tutor: TutorCardData;
  className?: string;
}

function initials(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim().charAt(0).toUpperCase();
  const l = (last ?? "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "?";
}

function formatHourlyRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate.toLocaleString("fr-FR")} FCFA/h`;
}

function renderStars(rating: number): React.ReactNode {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3",
            i < rounded
              ? "fill-accent-amber-400 text-accent-amber-400"
              : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Glass-card for a tutor in the "Find Tutors" listing.
 *
 * Two actions:
 *  - Prendre rendez-vous → link to /tutors/{id}/book
 *  - Contacter           → startConversationAction({ participantId })
 */
export function TutorCard({ tutor, className }: TutorCardProps) {
  const t = useTranslations("Users");
  const router = useRouter();
  const [messaging, setMessaging] = React.useState(false);

  const name =
    [tutor.firstName, tutor.lastName].filter(Boolean).join(" ") || "Tuteur";

  async function handleMessage() {
    setMessaging(true);
    const res = await startConversationAction({ participantId: tutor.id });
    setMessaging(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("messageMe"));
      return;
    }
    router.push(`/messages/${res.data.threadId}`);
  }

  return (
    <Card
      className={cn(
        "group glass-card relative flex h-full flex-col gap-4 rounded-2xl p-5",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-border-strong",
        tutor.isVerified
          ? "hover:shadow-[0_0_28px_-6px_rgba(147,217,26,0.4)]"
          : "hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.35)]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="size-12 border border-border">
          {tutor.avatarUrl ? (
            <AvatarImage src={tutor.avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback className="bg-accent-violet-500/10 font-semibold text-accent-violet-300">
            {initials(tutor.firstName, tutor.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/tutors/${tutor.id}`}
              className="truncate font-display text-base font-semibold text-foreground hover:text-primary-300"
            >
              {name}
            </Link>
            {tutor.isVerified && (
              <Badge variant="success" size="sm">
                <CheckCircle2 className="size-3" />
                {t("verifiedOnly")}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {renderStars(tutor.rating)}
              <span className="font-medium text-foreground">
                {tutor.rating.toFixed(1)}
              </span>
              <span>({tutor.reviewCount})</span>
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

      {/* Bio */}
      {tutor.bio && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {tutor.bio}
        </p>
      )}

      {/* Subjects */}
      {tutor.subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tutor.subjects.slice(0, 4).map((s) => (
            <Badge key={s} variant="brand" size="sm">
              {s}
            </Badge>
          ))}
          {tutor.subjects.length > 4 && (
            <Badge variant="secondary" size="sm">
              +{tutor.subjects.length - 4}
            </Badge>
          )}
        </div>
      )}

      {/* Footer: rate + sessions */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("hourlyRate")}
          </p>
          <p className="font-display text-sm font-semibold text-foreground">
            {formatHourlyRate(tutor.hourlyRate)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("sessions")}
          </p>
          <p className="font-display text-sm font-semibold text-foreground">
            {tutor.totalSessions}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="brand"
          size="sm"
          asChild
          className="flex-1"
        >
          <Link href={`/tutors/${tutor.id}/book`}>
            <Calendar className="size-4" />
            {t("bookSession")}
          </Link>
        </Button>
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={handleMessage}
          disabled={messaging}
          className="flex-1"
        >
          {messaging ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          {t("messageMe")}
        </Button>
      </div>
    </Card>
  );
}
