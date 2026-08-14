"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { SectionCard } from "@/components/shared/section-card";
import {
  TextField,
  SelectField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { updateSchoolAction } from "@/server/actions/schools";
import { SCHOOL_TYPE_VALUES } from "@/server/db/schema/enums";
import type { SchoolWithCounts } from "@/server/services/schools";

interface SchoolSettingsFormProps {
  school: SchoolWithCounts;
}

const settingsSchema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères").max(100),
  slug: z.string().max(100),
  city: z.string().max(100),
  region: z.string().max(100),
  type: z.enum(["public", "private", "parochial", "other"]),
  contactEmail: z.string().email("Email invalide").or(z.literal("")),
  contactPhone: z.string().max(20),
  logoUrl: z.string().url("URL invalide").or(z.literal("")),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

/**
 * §5.3 — School settings form (name, slug, type, city, region, contact).
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn Input (not native HTML inputs).
 */
export function SchoolSettingsForm({ school }: SchoolSettingsFormProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: school.name,
      slug: school.slug,
      city: school.city ?? "",
      region: school.region ?? "",
      type: (school.type ?? "public") as (typeof SCHOOL_TYPE_VALUES)[number],
      contactEmail: school.contactEmail ?? "",
      contactPhone: school.contactPhone ?? "",
      logoUrl: school.logoUrl ?? "",
    } as SettingsFormValues,
    validators: {
      onChange: settingsSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await updateSchoolAction({
        id: school.id,
        name: value.name.trim(),
        slug: value.slug.trim().toLowerCase(),
        city: value.city.trim() || null,
        region: value.region.trim() || null,
        type: value.type,
        contactEmail: value.contactEmail.trim() || null,
        contactPhone: value.contactPhone.trim() || null,
        logoUrl: value.logoUrl.trim() || null,
      });
      if (!result.success) {
        setServerError(result.error?.message ?? t("schoolSettings"));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    },
  });

  return (
    <SectionCard className="mt-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-5"
      >
        <form.Field name="name">
          {(field) => (
            <TextField
              field={field}
              label={t("schoolName")}
              required
            />
          )}
        </form.Field>

        <form.Field name="slug">
          {(field) => (
            <TextField
              field={field}
              label={t("slug")}
              description={t("slugHint")}
              inputClassName="font-mono"
            />
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="city">
            {(field) => (
              <TextField field={field} label={t("city")} />
            )}
          </form.Field>
          <form.Field name="region">
            {(field) => (
              <TextField field={field} label={t("region")} />
            )}
          </form.Field>
        </div>

        <form.Field name="type">
          {(field) => (
            <SelectField
              field={field}
              label={t("type")}
              options={SCHOOL_TYPE_VALUES.map((tp) => ({
                value: tp,
                label: t(`types.${tp}` as const),
              }))}
            />
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="contactEmail">
            {(field) => (
              <TextField
                field={field}
                label={t("contactEmail")}
                type="email"
              />
            )}
          </form.Field>
          <form.Field name="contactPhone">
            {(field) => (
              <TextField
                field={field}
                label={t("contactPhone")}
                type="tel"
              />
            )}
          </form.Field>
        </div>

        <form.Field name="logoUrl">
          {(field) => (
            <TextField
              field={field}
              label={t("logoUrl")}
              type="url"
              placeholder="https://…"
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) =>
            [state.canSubmit, state.isSubmitting, state.errors] as const
          }
        >
          {([canSubmit, isSubmitting, errors]) => (
            <>
              {serverError && <FormErrorBanner message={serverError} />}
              {errors.length > 0 && (
                <FormErrorBanner message="Veuillez corriger les erreurs ci-dessus" />
              )}
              <div className="flex justify-end">
                <SubmitButton
                  pending={isSubmitting}
                  disabled={!canSubmit}
                  size="lg"
                >
                  <Save className="size-4" />
                  {tCommon("save")}
                </SubmitButton>
              </div>
            </>
          )}
        </form.Subscribe>
      </form>
    </SectionCard>
  );
}
