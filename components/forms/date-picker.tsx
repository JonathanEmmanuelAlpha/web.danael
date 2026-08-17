"use client";

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
  className?: string;
  /** Disable dates before this one (inclusive). */
  fromDate?: Date;
  /** Disable dates after this one (inclusive). */
  toDate?: Date;
  /** Restrict to a specific year range (e.g. birth date: 1970 → current year - 1). */
  birthDateMode?: boolean;
  /** Caption layout for the calendar (e.g. "dropdown" for year/month selectors). */
  captionLayout?: "label" | "dropdown" | "dropdown-months" | "dropdown-years";
  /** Custom disabled predicate. */
  disabled?: (date: Date) => boolean;
}

/**
 * §6.2 — DatePicker (dates d'échéance devoirs, concours, réservations, birth date…).
 *
 * Features:
 *  - Solid background (no semi-transparent glass) for readability.
 *  - Optional `fromDate` / `toDate` to restrict the selectable range.
 *  - `birthDateMode` shortcut: restricts to [1970-01-01, current year - 1].
 *    Used in the profile form for the birth date field.
 *  - `captionLayout="dropdown"` shows year/month dropdowns — useful when
 *    navigating across many years (e.g. birth date).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  className,
  fromDate,
  toDate,
  birthDateMode = false,
  captionLayout,
  disabled,
}: DatePickerProps) {
  // Compute the effective date range.
  const effectiveFromDate = React.useMemo(() => {
    if (fromDate) return fromDate;
    if (birthDateMode) return new Date(1970, 0, 1);
    return undefined;
  }, [fromDate, birthDateMode]);

  const effectiveToDate = React.useMemo(() => {
    if (toDate) return toDate;
    if (birthDateMode) {
      // Current year - 1, end of year.
      const year = new Date().getFullYear() - 1;
      return new Date(year, 11, 31);
    }
    return undefined;
  }, [toDate, birthDateMode]);

  // In birth date mode, default to dropdown caption so users can jump across years.
  const effectiveCaptionLayout =
    captionLayout ?? (birthDateMode ? "dropdown" : "label");

  // The default year dropdown in react-day-picker starts at the `fromDate` year
  // and ends at the `toDate` year. When `birthDateMode` is on, this gives a
  // 1970 → (current year - 1) range, which is exactly what we want.

  return (
    <Popover>
      <PopoverTrigger className="z-50">
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal h-12",
            "bg-surface-solid border-border-strong hover:bg-surface-2",
            "focus-visible:border-primary-500 focus-visible:bg-surface-solid",
            !value && "text-muted-foreground",
            className,
          )}
          type="button"
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, "dd MMMM yyyy", { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-surface-solid border-border-strong w-auto p-0"
        align="start"
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          startMonth={effectiveFromDate}
          endMonth={effectiveToDate}
          captionLayout={effectiveCaptionLayout}
          disabled={[
            ...(effectiveFromDate ? [{ before: effectiveFromDate }] : []),
            ...(effectiveToDate ? [{ after: effectiveToDate }] : []),
            ...(disabled ? [disabled] : []),
          ]}
          className="bg-surface-solid border-border"
        />
      </PopoverContent>
    </Popover>
  );
}
