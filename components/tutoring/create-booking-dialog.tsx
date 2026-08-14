"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { useForm, useStore } from "@tanstack/react-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/tanstack-fields";
import { BookingCalendar } from "./booking-calendar";
import { createBookingAction } from "@/server/actions/tutoring";
import type { TutorAvailability } from "@/server/services/tutoring";

interface CreateBookingDialogProps {
  tutorProfileId: string;
  /** Student for whom the session is booked. */
  studentId: string;
  availabilities: TutorAvailability[];
  trigger?: React.ReactNode;
}

const bookingSchema = z.object({
  dateTime: z
    .date()
    .nullable()
    .refine(
      (d): d is Date => d !== null,
      "Veuillez sélectionner une date",
    ),
});

type BookingFormValues = {
  dateTime: Date | null;
};

/**
 * §5.15 — Dialog to book a tutoring session.
 *
 * Pick a date + time, then create a pending booking. Uses TanStack
 * Form with a hidden `dateTime` field that is set by the BookingCalendar
 * component via `form.setFieldValue`. The BookingCalendar UI is kept as-is.
 */
export function CreateBookingDialog({
  tutorProfileId,
  studentId,
  availabilities,
  trigger,
}: CreateBookingDialogProps) {
  const t = useTranslations("Tutoring");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      dateTime: null,
    } as BookingFormValues,
    validators: { onChange: bookingSchema },
    onSubmit: async ({ value }) => {
      if (!value.dateTime) {
        toast.error(t("selectTimeFirst"));
        return;
      }
      const result = await createBookingAction({
        tutorProfileId,
        studentId,
        scheduledAt: value.dateTime.toISOString(),
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("bookingFailed"));
        return;
      }
      toast.success(t("bookingCreated"));
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });

  const dateTime = useStore(form.store, (s) => s.values.dateTime);
  const hasAvailabilities = availabilities.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand" disabled={!hasAvailabilities}>
            <CalendarCheck className="size-4" />
            {t("bookSession")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-primary-600" />
            {t("bookSession")}
          </DialogTitle>
          <DialogDescription>{t("bookSessionDescription")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          {!hasAvailabilities ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              {t("noAvailabilities")}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block">{t("selectedDateTime")}</Label>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  {dateTime
                    ? dateTime.toLocaleString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : t("none")}
                </div>
              </div>
              <BookingCalendar
                availabilities={availabilities}
                value={dateTime}
                onChange={(d) => form.setFieldValue("dateTime", d)}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <form.Subscribe
              selector={(state) =>
                [
                  state.canSubmit,
                  state.isSubmitting,
                  state.values.dateTime,
                ] as const
              }
            >
              {([canSubmit, isSubmitting, dt]) => (
                <SubmitButton
                  pending={isSubmitting}
                  disabled={!canSubmit || !dt || !hasAvailabilities}
                >
                  {isSubmitting ? t("confirming") : t("confirmBooking")}
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
