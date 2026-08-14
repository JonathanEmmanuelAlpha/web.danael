"use client";

/**
 * Weekly emotional check-in card — Aurora Navy.
 *
 * 5 emoji buttons + optional TanStack Form text note. Calls
 * `recordEmotionalCheckinAction` on submit. If already answered this
 * week, shows a warm thank-you state instead.
 *
 * Glass-card with a soft amber halo to convey warmth.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { Heart, Send } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TextAreaField, SubmitButton } from "@/components/forms/tanstack-fields";
import { recordEmotionalCheckinAction } from "@/server/actions/learning";
import type { EmotionalStateValue } from "@/server/db/schema/enums";
import { cn } from "@/lib/utils";

const EMOJI_MAP: Record<EmotionalStateValue, string> = {
  great: "😊",
  good: "🙂",
  okay: "😐",
  stressed: "😟",
  overwhelmed: "😣",
};

const STATE_KEYS: EmotionalStateValue[] = [
  "great",
  "good",
  "okay",
  "stressed",
  "overwhelmed",
];

const checkinSchema = z.object({
  note: z.string().max(500).optional().or(z.literal("")),
});

type CheckinValues = z.infer<typeof checkinSchema>;

export interface EmotionalCheckinProps {
  /** ISO week key of the latest check-in ("2026-W33"). */
  lastCheckinWeek?: string | null;
  /** The latest state if any. */
  latestState?: EmotionalStateValue | null;
  className?: string;
}

/** Get the current ISO week key (matches the server's getCurrentWeekKey). */
function getCurrentWeekKey(d: Date = new Date()): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      (date.getTime() - firstThursday.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function EmotionalCheckin({
  lastCheckinWeek,
  latestState,
  className,
}: EmotionalCheckinProps) {
  const t = useTranslations("Learning");
  const [selected, setSelected] = React.useState<EmotionalStateValue | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const doneThisWeek = Boolean(
    lastCheckinWeek && lastCheckinWeek === getCurrentWeekKey(),
  );

  const form = useForm({
    defaultValues: { note: "" } as CheckinValues,
    validators: { onChange: checkinSchema },
    onSubmit: async ({ value }) => {
      if (!selected) return;
      setSubmitting(true);
      const result = await recordEmotionalCheckinAction({
        state: selected,
        note: value.note?.trim() || undefined,
      });
      setSubmitting(false);
      if (!result.success) {
        toast.error(result.error?.message ?? t("emotionalCheckin"));
        return;
      }
      toast.success(t("emotionalCheckinDone"));
      // Optimistically mark as done so the UI swaps to the thank-you state.
      // A full revalidation will happen server-side via revalidatePath.
      window.location.reload();
    },
  });

  // ── Already answered this week ────────────────────────────────
  if (doneThisWeek) {
    return (
      <Card
        className={cn(
          "relative overflow-hidden p-5 animate-fade-up",
          className,
        )}
      >
        <div
          aria-hidden
          className="halo-amber absolute -right-12 -top-12 size-40 opacity-40"
        />
        <div className="relative flex items-start gap-3">
          <div className="glass flex size-10 shrink-0 items-center justify-center rounded-xl text-accent-amber-400 glow-amber">
            <Heart className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold text-foreground">
                {t("emotionalCheckinDone")}
              </h3>
              {latestState && (
                <Badge variant="warning" size="sm">
                  <span className="mr-1">{EMOJI_MAP[latestState]}</span>
                  {t(`emotionalStates.${latestState}` as const)}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("emotionalCheckinDoneHint")}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // ── Active check-in form ──────────────────────────────────────
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5 animate-fade-up",
        className,
      )}
    >
      <div
        aria-hidden
        className="halo-amber absolute -right-12 -top-12 size-40 opacity-30"
      />
      <div className="relative flex items-center gap-2.5">
        <div className="glass flex size-9 shrink-0 items-center justify-center rounded-lg text-accent-amber-400 glow-amber">
          <Heart className="size-5" aria-hidden />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">
            {t("emotionalCheckin")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("emotionalCheckinHint")}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="relative mt-4 space-y-4"
      >
        {/* Emoji buttons */}
        <div
          role="radiogroup"
          aria-label={t("emotionalCheckin")}
          className="grid grid-cols-5 gap-2"
        >
          {STATE_KEYS.map((state) => {
            const isActive = selected === state;
            return (
              <button
                key={state}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setSelected(state)}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all",
                  isActive
                    ? "border-accent-amber-500/60 bg-accent-amber-500/10 shadow-[0_0_16px_-4px_rgba(251,191,36,0.5)]"
                    : "border-border bg-white/[0.03] hover:border-border-strong hover:bg-white/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "text-2xl transition-transform",
                    isActive
                      ? "scale-110"
                      : "group-hover:scale-105 opacity-80 group-hover:opacity-100",
                  )}
                  aria-hidden
                >
                  {EMOJI_MAP[state]}
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-tight font-medium",
                    isActive ? "text-accent-amber-300" : "text-muted-foreground",
                  )}
                >
                  {t(`emotionalStates.${state}` as const)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Optional note */}
        <form.Field name="note">
          {(field) => (
            <TextAreaField
              field={field}
              label={t("emotionalCheckinNote")}
              placeholder={t("emotionalCheckinNotePlaceholder")}
              rows={3}
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.isSubmitting] as const}
        >
          {([isSubmitting]) => (
            <SubmitButton
              pending={submitting || isSubmitting}
              disabled={!selected}
              variant="brand"
              size="sm"
              className="w-full"
            >
              <Send className="size-4" />
              {t("emotionalCheckinSubmit")}
            </SubmitButton>
          )}
        </form.Subscribe>
      </form>
    </Card>
  );
}
