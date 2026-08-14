"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import {
  TextField,
  TextAreaField,
  SelectField,
  DateField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import {
  COMPETITION_SCOPE_VALUES,
  LEVEL_VALUES,
  SERIES_VALUES,
} from "@/server/db/schema/enums";
import { createCompetitionAction } from "@/server/actions/competitions";

const inOneWeek = new Date();
inOneWeek.setDate(inOneWeek.getDate() + 7);
const inTwoWeeks = new Date();
inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

/**
 * §5.7 — Create competition form (teacher view).
 *
 * Fields: title, description, scope, level, series, start/end dates, prize.
 * Scope defaults to "class" (most restrictive, safest), level/series optional.
 *
 * Uses TanStack Form + Zod (Standard Schema) + shadcn/ui field wrappers.
 */
export function CompetitionForm() {
  const t = useTranslations("Competitions");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z
    .object({
      title: z
        .string()
        .max(200)
        .refine((v) => v.trim().length > 0, { message: t("titleRequired") }),
      description: z.string().max(2000).optional().or(z.literal("")),
      scope: z.enum(COMPETITION_SCOPE_VALUES),
      level: z.enum(LEVEL_VALUES).optional().or(z.literal("")),
      series: z.enum(SERIES_VALUES).optional().or(z.literal("")),
      startAt: z.date(),
      endAt: z.date(),
      prizeDescription: z.string().max(1000).optional().or(z.literal("")),
    })
    .refine((data) => data.endAt > data.startAt, {
      message: t("endBeforeStart"),
      path: ["endAt"],
    });

  type FormValues = z.infer<typeof schema>;

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      scope: "class",
      level: "",
      series: "",
      startAt: inOneWeek,
      endAt: inTwoWeeks,
      prizeDescription: "",
    } as FormValues,
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      const result = await createCompetitionAction({
        title: value.title.trim(),
        description: value.description?.trim() || undefined,
        scope: value.scope,
        level: (value.level || undefined) as
          | (typeof LEVEL_VALUES)[number]
          | undefined,
        series: (value.series || undefined) as
          | (typeof SERIES_VALUES)[number]
          | undefined,
        startAt: value.startAt.toISOString(),
        endAt: value.endAt.toISOString(),
        prizeDescription: value.prizeDescription?.trim() || undefined,
      });
      if (!result.success) {
        setServerError(result.error.message);
        return;
      }
      setServerError(null);
      toast.success(t("competitionCreated"));
      router.push(`/teacher-competitions/${result.data.id}`);
      router.refresh();
    },
  });

  return (
    <SectionCard title={t("newCompetition")} description={t("newCompetitionHint")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-5"
      >
        <FormErrorBanner message={serverError} />

        {/* Title */}
        <form.Field name="title">
          {(field) => (
            <TextField
              field={field}
              label={t("titleField")}
              placeholder={t("titlePlaceholder")}
              required
              autoFocus
              inputClassName="h-12"
            />
          )}
        </form.Field>

        {/* Description */}
        <form.Field name="description">
          {(field) => (
            <TextAreaField
              field={field}
              label={
                <>
                  {t("descriptionField")}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({tCommon("optional")})
                  </span>
                </>
              }
              placeholder={t("descriptionPlaceholder")}
              rows={4}
            />
          )}
        </form.Field>

        {/* Scope + Level + Series */}
        <div className="grid gap-4 sm:grid-cols-3">
          <form.Field name="scope">
            {(field) => (
              <SelectField
                field={field}
                label={t("scopeField")}
                options={COMPETITION_SCOPE_VALUES.map((s) => ({
                  value: s,
                  label: t(`scope.${s}`),
                }))}
              />
            )}
          </form.Field>
          <form.Field name="level">
            {(field) => (
              <SelectField
                field={field}
                label={
                  <>
                    {t("levelField")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={tCommon("none")}
                options={LEVEL_VALUES.map((l) => ({ value: l, label: l }))}
              />
            )}
          </form.Field>
          <form.Field name="series">
            {(field) => (
              <SelectField
                field={field}
                label={
                  <>
                    {t("seriesField")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={tCommon("none")}
                options={SERIES_VALUES.map((s) => ({ value: s, label: s }))}
              />
            )}
          </form.Field>
        </div>

        {/* Start / End */}
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="startAt">
            {(field) => (
              <DateField field={field} label={t("startDate")} required />
            )}
          </form.Field>
          <form.Field name="endAt">
            {(field) => (
              <DateField field={field} label={t("endDate")} required />
            )}
          </form.Field>
        </div>

        {/* Prize description */}
        <form.Field name="prizeDescription">
          {(field) => (
            <TextField
              field={field}
              label={
                <>
                  {t("prizeField")}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({tCommon("optional")})
                  </span>
                </>
              }
              placeholder={t("prizePlaceholder")}
              inputClassName="h-12"
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/teacher-competitions")}
                disabled={isSubmitting}
              >
                {tCommon("cancel")}
              </Button>
              <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                <Save className="size-4" />
                {t("create")}
              </SubmitButton>
            </div>
          )}
        </form.Subscribe>
      </form>
    </SectionCard>
  );
}
