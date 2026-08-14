"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, School, Save } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import {
  TextField,
  SelectField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { createSchoolAction } from "@/server/actions/schools";
import { SCHOOL_TYPE_VALUES } from "@/server/db/schema/enums";
import type { SchoolWithCounts } from "@/server/services/schools";

interface CreateSchoolFormProps {
  onCreated?: (school: SchoolWithCounts) => void;
}

const createSchoolSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit comporter au moins 2 caractères")
    .max(100),
  city: z.string().max(100).optional().or(z.literal("")),
  region: z.string().max(100).optional().or(z.literal("")),
  type: z.enum(["public", "private", "parochial", "other"]),
  contactEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  contactPhone: z.string().max(20).optional().or(z.literal("")),
});

type CreateSchoolValues = z.infer<typeof createSchoolSchema>;

/**
 * §5.3 — Form to create a new school (school onboarding).
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn Input (not native HTML inputs).
 * The school's joinCode is auto-generated server-side.
 */
export function CreateSchoolForm({ onCreated }: CreateSchoolFormProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      name: "",
      city: "",
      region: "",
      type: "public",
      contactEmail: "",
      contactPhone: "",
    } as CreateSchoolValues,
    validators: {
      onChange: createSchoolSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await createSchoolAction({
        name: value.name.trim(),
        city: value.city?.trim() || undefined,
        region: value.region?.trim() || undefined,
        type: value.type,
        contactEmail: value.contactEmail?.trim() || undefined,
        contactPhone: value.contactPhone?.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error.message ?? t("createSchool"));
        return;
      }
      toast.success(t("schoolCreated"));
      onCreated?.(result.data);
      router.push("/dashboard");
      router.refresh();
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("createSchool")}
        description={t("createSchoolDescription")}
        icon={<School className="size-6" />}
      />
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
                placeholder="Lycée Leclerc"
                required
                autoFocus
              />
            )}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="city">
              {(field) => (
                <TextField
                  field={field}
                  label={t("city")}
                  placeholder="Yaoundé"
                />
              )}
            </form.Field>
            <form.Field name="region">
              {(field) => (
                <TextField
                  field={field}
                  label={t("region")}
                  placeholder="Centre"
                />
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
                  placeholder="contact@lycee-leclerc.org"
                  type="email"
                />
              )}
            </form.Field>
            <form.Field name="contactPhone">
              {(field) => (
                <TextField
                  field={field}
                  label={t("contactPhone")}
                  placeholder="+237 …"
                  type="tel"
                />
              )}
            </form.Field>
          </div>

          <form.Subscribe
            selector={(state) =>
              [state.canSubmit, state.isSubmitting, state.errors] as const
            }
          >
            {([canSubmit, isSubmitting, errors]) => (
              <>
                {errors.length > 0 && (
                  <FormErrorBanner message="Veuillez corriger les erreurs ci-dessus" />
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    {tCommon("back")}
                  </Button>
                  <SubmitButton
                    pending={isSubmitting}
                    disabled={!canSubmit}
                    size="lg"
                  >
                    <Save className="size-4" />
                    {tCommon("create")}
                  </SubmitButton>
                </div>
              </>
            )}
          </form.Subscribe>
        </form>
      </SectionCard>
    </div>
  );
}
