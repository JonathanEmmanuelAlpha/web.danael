"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock } from "lucide-react";
import type { TutorAvailability } from "@/server/services/tutoring";

interface BookingCalendarProps {
  availabilities: TutorAvailability[];
  /** Selected datetime, controlled by parent. */
  value?: Date | null;
  onChange: (next: Date | null) => void;
}

const DAY_NAMES = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

const TIMES = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 30]) {
      out.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return out;
})();

/**
 * §5.15 — Booking calendar / time slot picker.
 *
 * Given the tutor's weekly recurring availabilities, the calendar lets the
 * user pick a date and a matching time slot.
 */
export function BookingCalendar({
  availabilities,
  value,
  onChange,
}: BookingCalendarProps) {
  const t = useTranslations("Tutoring");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Map availabilities by day-of-week.
  const slotsByDay = useMemo(() => {
    const map = new Map<number, TutorAvailability[]>();
    for (const a of availabilities) {
      const arr = map.get(a.dayOfWeek) ?? [];
      arr.push(a);
      map.set(a.dayOfWeek, arr);
    }
    return map;
  }, [availabilities]);

  function isDateAvailable(date: Date): boolean {
    const dow = date.getDay();
    return (slotsByDay.get(dow) ?? []).length > 0;
  }

  function matchingSlotsForDay(date: Date): TutorAvailability[] {
    return slotsByDay.get(date.getDay()) ?? [];
  }

  function selectTime(time: string) {
    if (!selectedDate) return;
    const [h, m] = time.split(":").map(Number);
    const dt = new Date(selectedDate);
    dt.setHours(h, m, 0, 0);
    onChange(dt);
  }

  const slotsForSelected = selectedDate ? matchingSlotsForDay(selectedDate) : [];
  const availableTimes = TIMES.filter((t) =>
    slotsForSelected.some((s) => s.startTime <= t && s.endTime > t),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <Label>{t("selectDate")}</Label>
        <div className="flex justify-center rounded-lg border border-border bg-card p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              setSelectedDate(d);
              onChange(null);
            }}
            disabled={(d) => !isDateAvailable(d) || d < addDays(new Date(), -1)}
            locale={fr}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("selectTime")}</Label>
        {!selectedDate ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            {t("selectDateFirst")}
          </div>
        ) : availableTimes.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            {t("noSlotsForDay")}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {availableTimes.map((time) => {
              const isSelected =
                value &&
                selectedDate &&
                isSameDay(value, selectedDate) &&
                format(value, "HH:mm") === time;
              return (
                <Button
                  key={time}
                  type="button"
                  variant={isSelected ? "brand" : "outline"}
                  size="sm"
                  className="h-10"
                  onClick={() => selectTime(time)}
                >
                  <Clock className="size-3.5" />
                  {time}
                </Button>
              );
            })}
          </div>
        )}

        {selectedDate && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{DAY_NAMES[selectedDate.getDay()]}</span>
            <span>·</span>
            <span>{format(selectedDate, "d MMM yyyy", { locale: fr })}</span>
            {slotsForSelected.length > 0 && (
              <Badge variant="secondary" size="sm">
                {slotsForSelected.length} créneau(x)
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
