"use client";

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

interface DatePickerProps {
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
  className?: string;
}

/** §6.2 — DatePicker (dates d'échéance devoirs, concours, réservations…). */
export function DatePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  className,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal h-12",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, "dd MMMM yyyy", { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} />
      </PopoverContent>
    </Popover>
  );
}
