"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  X,
} from "lucide-react";
import type { TutorBooking } from "@/server/services/tutoring";

interface BookingCardProps {
  booking: TutorBooking;
  /** Whether the current user is the tutor for this booking. */
  viewerIsTutor: boolean;
  /** Whether the current user is the booker (parent/student). */
  viewerIsBooker: boolean;
  onConfirm?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(status: string) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "confirmed":
      return "info" as const;
    case "cancelled":
    case "no_show":
      return "destructive" as const;
    default:
      return "warning" as const;
  }
}

/**
 * §5.15 — Booking card with status + actions.
 */
export function BookingCard({
  booking,
  viewerIsTutor,
  viewerIsBooker,
  onConfirm,
  onComplete,
  onCancel,
}: BookingCardProps) {
  const t = useTranslations("Tutoring");

  const isPast = useMemo(
    () => new Date(booking.scheduledAt).getTime() < Date.now(),
    [booking.scheduledAt],
  );
  const canConfirm = viewerIsTutor && booking.status === "pending";
  const canComplete =
    viewerIsTutor && booking.status === "confirmed" && !isPast;
  const canCancel =
    (viewerIsTutor || viewerIsBooker) &&
    (booking.status === "pending" || booking.status === "confirmed");

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-400">
            <CalendarClock className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">
              {formatDateTime(booking.scheduledAt)}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="size-3" />
              {(booking.price ?? 0).toLocaleString("fr-FR")} FCFA
            </p>
          </div>
        </div>
        <Badge variant={statusVariant(booking.status)} size="sm">
          {t(`bookingStatus.${booking.status}` as const)}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canConfirm && (
          <Button size="sm" variant="brand" onClick={() => onConfirm?.(booking.id)}>
            <Check className="size-3.5" />
            {t("confirm")}
          </Button>
        )}
        {canComplete && (
          <Button size="sm" variant="brand-outline" onClick={() => onComplete?.(booking.id)}>
            <CheckCircle2 className="size-3.5" />
            {t("markCompleted")}
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCancel?.(booking.id)}
            className="text-destructive hover:bg-destructive/10"
          >
            <X className="size-3.5" />
            {t("cancel")}
          </Button>
        )}
        {booking.status === "pending" && !viewerIsTutor && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" />
            {t("waitingTutorConfirmation")}
          </div>
        )}
      </div>
    </Card>
  );
}
