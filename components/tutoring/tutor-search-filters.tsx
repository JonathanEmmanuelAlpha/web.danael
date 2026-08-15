"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { useForm, useSelector } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  TextField,
  SelectField,
  NumberField,
  CheckboxField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";

export interface TutorFiltersValue {
  search?: string;
  subjectId?: string;
  level?: "6e" | "5e" | "4e" | "3e" | "2nde" | "1ere" | "Tle";
  minRating?: number;
  maxRate?: number;
  location?: string;
  verifiedOnly?: boolean;
}

interface TutorSearchFiltersProps {
  subjects: Array<{ id: string; name: string; code: string }>;
  value: TutorFiltersValue;
  onChange: (next: TutorFiltersValue) => void;
  onApply: () => void;
}

const LEVELS = [
  { value: "6e", label: "6ᵉ" },
  { value: "5e", label: "5ᵉ" },
  { value: "4e", label: "4ᵉ" },
  { value: "3e", label: "3ᵉ" },
  { value: "2nde", label: "2nde" },
  { value: "1ere", label: "1ʳᵉ" },
  { value: "Tle", label: "Terminale" },
] as const;

const filtersSchema = z.object({
  search: z.string(),
  subjectId: z.string(),
  level: z.string(),
  location: z.string(),
  minRating: z.string(),
  maxRate: z.number(),
  verifiedOnly: z.boolean(),
});

type FiltersFormValues = z.infer<typeof filtersSchema>;

const EMPTY_DEFAULTS: FiltersFormValues = {
  search: "",
  subjectId: "all",
  level: "all",
  location: "",
  minRating: "0",
  maxRate: 20000,
  verifiedOnly: false,
};

function toFiltersValue(v: FiltersFormValues): TutorFiltersValue {
  return {
    search: v.search || undefined,
    subjectId: v.subjectId === "all" ? undefined : v.subjectId,
    level:
      v.level === "all" ? undefined : (v.level as TutorFiltersValue["level"]),
    location: v.location || undefined,
    minRating: v.minRating === "0" ? undefined : Number(v.minRating),
    maxRate: v.maxRate,
    verifiedOnly: v.verifiedOnly,
  };
}

/**
 * §5.15 — Tutor search filters bar.
 *
 * Uses TanStack Form + Zod for all filter fields. The form is the
 * source of truth after mount; the parent is kept in sync via a
 * useEffect that calls `onChange` on every value change. Apply and
 * Reset behaviour is preserved.
 */
export function TutorSearchFilters({
  subjects,
  value,
  onChange,
  onApply,
}: TutorSearchFiltersProps) {
  const t = useTranslations("Tutoring");

  const form = useForm({
    defaultValues: {
      search: value.search ?? "",
      subjectId: value.subjectId ?? "all",
      level: value.level ?? "all",
      location: value.location ?? "",
      minRating: value.minRating != null ? String(value.minRating) : "0",
      maxRate: value.maxRate ?? 20000,
      verifiedOnly: value.verifiedOnly ?? false,
    } as FiltersFormValues,
    validators: { onChange: filtersSchema },
    onSubmit: async () => {
      onApply();
      // Preserve the original "fake pending" visual feedback (200ms).
      await new Promise((resolve) => setTimeout(resolve, 200));
    },
  });

  const formValues = useSelector(form.store, (s) => s.values);
  useEffect(() => {
    onChange(toFiltersValue(formValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues]);

  function reset() {
    form.reset(EMPTY_DEFAULTS);
    setTimeout(onApply, 0);
  }

  const subjectOptions = [
    { value: "all", label: t("allSubjects") },
    ...subjects.map((s) => ({ value: s.id, label: s.name })),
  ];

  const levelOptions = [
    { value: "all", label: t("allLevels") },
    ...LEVELS.map((l) => ({ value: l.value, label: l.label })),
  ];

  const ratingOptions = [
    { value: "0", label: t("anyRating") },
    { value: "3", label: "3+ ★" },
    { value: "4", label: "4+ ★" },
    { value: "4.5", label: "4.5+ ★" },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <form.Field name="search">
        {(field) => (
          <TextField
            field={field}
            label={t("search")}
            placeholder={t("searchPlaceholder")}
            leading={<Search className="size-4" />}
          />
        )}
      </form.Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <form.Field name="subjectId">
          {(field) => (
            <SelectField
              field={field}
              label={t("subject")}
              options={subjectOptions}
            />
          )}
        </form.Field>

        <form.Field name="level">
          {(field) => (
            <SelectField
              field={field}
              label={t("level")}
              options={levelOptions}
            />
          )}
        </form.Field>

        <form.Field name="location">
          {(field) => (
            <TextField
              field={field}
              label={t("location")}
              placeholder={t("locationPlaceholder")}
            />
          )}
        </form.Field>

        <form.Field name="minRating">
          {(field) => (
            <SelectField
              field={field}
              label={t("minRating")}
              options={ratingOptions}
            />
          )}
        </form.Field>
      </div>

      <form.Field name="maxRate">
        {(field) => (
          <NumberField
            field={field}
            label={t("maxRate")}
            min={1000}
            max={20000}
            step={500}
          />
        )}
      </form.Field>

      <div className="flex items-center justify-between gap-2">
        <form.Field name="verifiedOnly">
          {(field) => <CheckboxField field={field} label={t("verifiedOnly")} />}
        </form.Field>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <X className="size-3.5" />
            {t("reset")}
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <SubmitButton
                pending={isSubmitting}
                disabled={!canSubmit}
                size="sm"
              >
                {t("applyFilters")}
              </SubmitButton>
            )}
          </form.Subscribe>
        </div>
      </div>
    </form>
  );
}
