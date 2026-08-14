"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SelectField,
  TimeField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { setAvailabilityAction } from "@/server/actions/tutoring";
import type { TutorAvailability } from "@/server/services/tutoring";

interface TutorAvailabilityEditorProps {
  profileId: string;
  initial: TutorAvailability[];
}

const DAYS = [
  { value: 0, label: "Dim" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
] as const;

type SlotDraft = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

function slotKey(s: SlotDraft): string {
  return `${s.dayOfWeek}-${s.startTime}-${s.endTime}`;
}

function slotsEqual(a: SlotDraft, b: SlotDraft): boolean {
  return slotKey(a) === slotKey(b);
}

function fromAvail(a: TutorAvailability): SlotDraft {
  return {
    dayOfWeek: a.dayOfWeek,
    startTime: a.startTime,
    endTime: a.endTime,
  };
}

const draftSchema = z
  .object({
    dayOfWeek: z.string().min(1, "Jour requis"),
    startTime: z.string().min(1, "Heure de début requise"),
    endTime: z.string().min(1, "Heure de fin requise"),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["endTime"],
  });

type DraftFormValues = z.infer<typeof draftSchema>;

/**
 * §5.15 — Weekly availability editor for tutors.
 *
 * The "add slot" draft form uses TanStack Form + Zod. The slots list
 * and the save action remain useState-driven (the save button is a
 * plain Button, not a form submit).
 */
export function TutorAvailabilityEditor({
  profileId,
  initial,
}: TutorAvailabilityEditorProps) {
  const t = useTranslations("Tutoring");
  const [slots, setSlots] = useState<SlotDraft[]>(initial.map(fromAvail));
  const [pending, setPending] = useState(false);

  const dayOptions = DAYS.map((d) => ({
    value: String(d.value),
    label: d.label,
  }));

  const draftForm = useForm({
    defaultValues: {
      dayOfWeek: "1",
      startTime: "09:00",
      endTime: "11:00",
    } as DraftFormValues,
    validators: { onChange: draftSchema },
    onSubmit: async ({ value }) => {
      const newSlot: SlotDraft = {
        dayOfWeek: Number(value.dayOfWeek),
        startTime: value.startTime,
        endTime: value.endTime,
      };
      if (slots.some((s) => slotsEqual(s, newSlot))) {
        toast.error(t("slotAlreadyExists"));
        return;
      }
      setSlots([...slots, newSlot]);
    },
  });

  function removeSlot(idx: number) {
    setSlots(slots.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setPending(true);
    const result = await setAvailabilityAction({ profileId, slots });
    setPending(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("saveFailed"));
      return;
    }
    toast.success(t("availabilitySaved"));
  }

  return (
    <Card className="gap-0 p-5">
      <div className="space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">
            {t("weeklyAvailability")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("weeklyAvailabilityHint")}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void draftForm.handleSubmit();
          }}
          className="grid gap-3 sm:grid-cols-4"
        >
          <draftForm.Field name="dayOfWeek">
            {(field) => (
              <SelectField field={field} label={t("day")} options={dayOptions} />
            )}
          </draftForm.Field>
          <draftForm.Field name="startTime">
            {(field) => (
              <TimeField field={field} label={t("startTime")} />
            )}
          </draftForm.Field>
          <draftForm.Field name="endTime">
            {(field) => (
              <TimeField field={field} label={t("endTime")} />
            )}
          </draftForm.Field>
          <draftForm.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <div className="flex items-end">
                <SubmitButton
                  pending={isSubmitting}
                  disabled={!canSubmit}
                  variant="outline"
                  className="h-10 w-full"
                >
                  <Plus className="size-4" />
                  {t("addSlot")}
                </SubmitButton>
              </div>
            )}
          </draftForm.Subscribe>
        </form>

        {slots.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            {t("noSlots")}
          </div>
        ) : (
          <ul className="space-y-2">
            {slots.map((s, idx) => (
              <li
                key={slotKey(s) + idx}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="brand" size="sm">
                    {DAYS.find((d) => d.value === s.dayOfWeek)?.label}
                  </Badge>
                  <span className="text-sm font-medium">
                    {s.startTime} → {s.endTime}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10"
                  onClick={() => removeSlot(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="brand"
            onClick={handleSave}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("saveAvailability")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
