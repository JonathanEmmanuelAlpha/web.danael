"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "../shared/glass-card";
import {
  TextField,
  RadioGroupField,
  DateField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { User, UserGender } from "@/server/db/schema";
import { completeProfileAction } from "@/server/actions/onboarding";

/** §5.2 — Formulaire de complétion de profil (champs obligatoires). */
export function ProfileForm({ user }: { user: User }) {
  const params = useSearchParams();

  const t = useTranslations("Onboarding.Profile");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const profileSchema = useMemo(
    () =>
      z
        .object({
          firstName: z.string().min(2, "Au moins 2 caractères"),
          lastName: z.string().min(2, "Au moins 2 caractères"),
          phone: z.string(),
          gender: z.enum(["male", "female"]),
          addressCity: z.string().min(2, "Au moins 2 caractères"),
          addressRegion: z.string().min(2, "Au moins 2 caractères"),
          addressCountry: z.string().min(2, "Au moins 2 caractères"),
          addressQuarter: z.string().optional().or(z.literal("")),
          birthDate: z.date().nullable(),
        })
        .refine((d) => user.role !== "student" || d.birthDate !== null, {
          path: ["birthDate"],
          message: "La date de naissance est requise",
        }),
    [user.role],
  );

  type ProfileValues = z.infer<typeof profileSchema>;

  const form = useForm({
    defaultValues: {
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      phone: user.phone ?? "",
      gender: (user.gender ?? "male") as UserGender,
      addressCity: user.address?.city ?? "",
      addressRegion: user.address?.region ?? "",
      addressCountry: user.address?.country ?? "",
      addressQuarter: user.address?.quater ?? "",
      birthDate: user.birthDate ?? null,
    } as ProfileValues,
    validators: { onChange: profileSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const res = await completeProfileAction({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        phone: value.phone.trim(),
        gender: value.gender,
        addressCity: value.addressCity.trim(),
        addressRegion: value.addressRegion.trim(),
        addressCountry: value.addressCountry.trim(),
        addressQuarter: value.addressQuarter?.trim() || undefined,
        birthDate:
          user.role === "student" || value.birthDate
            ? (value.birthDate ?? undefined)
            : undefined,
      });
      if (res.success) {
        toast.success(t("profileCompleted"));
        router.push(`/onboarding/${params.get("target") ?? user.role}`);
      } else {
        setServerError(res.error.code);
      }
    },
  });

  return (
    <div className="space-y-5 p-6">
      <h2 className="font-display text-xl font-semibold">
        {t("personalInfo")}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="firstName">
            {(field) => (
              <TextField
                field={field}
                label={t("firstName")}
                placeholder={t("firstName")}
                required
                inputClassName="danael-input"
              />
            )}
          </form.Field>
          <form.Field name="lastName">
            {(field) => (
              <TextField
                field={field}
                label={t("lastName")}
                placeholder={t("lastName")}
                required
                inputClassName="danael-input"
              />
            )}
          </form.Field>
          <form.Field name="phone">
            {(field) => (
              <TextField
                field={field}
                label={t("phone")}
                placeholder={t("phone")}
                inputClassName="danael-input"
              />
            )}
          </form.Field>
          {user.role === "student" && (
            <form.Field name="birthDate">
              {(field) => (
                <DateField
                  field={field}
                  label={t("birthDate")}
                  placeholder={t("birthDate")}
                  required
                  birthDateMode
                />
              )}
            </form.Field>
          )}
          <form.Field name="gender">
            {(field) => (
              <RadioGroupField
                field={field}
                label={t("genderSelect")}
                groupClassName="flex flex-row"
                required
                options={[
                  { value: "male", label: t("genderMale") },
                  { value: "female", label: t("genderFemale") },
                ]}
              />
            )}
          </form.Field>
        </div>

        <h3 className="font-display mt-6 text-lg font-semibold">
          {t("address")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="addressCity">
            {(field) => (
              <TextField
                field={field}
                label={t("city")}
                placeholder={t("city")}
                required
                inputClassName="danael-input"
              />
            )}
          </form.Field>
          <form.Field name="addressRegion">
            {(field) => (
              <TextField
                field={field}
                label={t("region")}
                placeholder={t("region")}
                required
                inputClassName="danael-input"
              />
            )}
          </form.Field>
          <form.Field name="addressCountry">
            {(field) => (
              <TextField
                field={field}
                label={t("country")}
                placeholder={t("country")}
                required
                inputClassName="danael-input"
              />
            )}
          </form.Field>
          <form.Field name="addressQuarter">
            {(field) => (
              <TextField
                field={field}
                label={t("quarter")}
                placeholder={t("quarter")}
                inputClassName="danael-input"
              />
            )}
          </form.Field>
        </div>

        <FormErrorBanner message={serverError} />

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
              <SubmitButton
                pending={isSubmitting}
                disabled={!canSubmit}
                size="lg"
                className="danael-btn-primary mt-6 w-full"
              >
                {t("save")}
                <ArrowRight className="size-5" />
              </SubmitButton>
            </>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
