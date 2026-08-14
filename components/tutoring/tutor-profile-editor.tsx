"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TextField,
  TextAreaField,
  NumberField,
  SelectField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import {
  createTutorProfileAction,
  updateTutorProfileAction,
  addTutorSubjectAction,
  removeTutorSubjectAction,
} from "@/server/actions/tutoring";
import type { TutorProfilePublic } from "@/server/services/tutoring";

interface TutorProfileEditorProps {
  /** Existing profile (null if the tutor has none yet). */
  profile: TutorProfilePublic | null;
  subjects: Array<{ id: string; name: string; code: string }>;
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

const profileSchema = z.object({
  bio: z
    .string()
    .max(2000)
    .refine(
      (v) => v.trim().length >= 20,
      "La bio doit comporter au moins 20 caractères",
    ),
  hourlyRate: z
    .number()
    .int()
    .min(0, "Le taux horaire ne peut pas être négatif"),
  location: z
    .string()
    .max(200)
    .refine(
      (v) => v.trim().length >= 1,
      "La localisation est requise",
    ),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const subjectSchema = z.object({
  subjectId: z.string().min(1, "Veuillez choisir une matière"),
  level: z.enum([
    "6e",
    "5e",
    "4e",
    "3e",
    "2nde",
    "1ere",
    "Tle",
  ]),
});

type SubjectFormValues = z.infer<typeof subjectSchema>;

/**
 * §5.15 — Tutor profile editor (bio, hourly rate, location, subjects).
 *
 * Uses two TanStack Form instances: one for the profile basics
 * (bio / hourlyRate / location) and one for adding a subject.
 */
export function TutorProfileEditor({
  profile,
  subjects,
}: TutorProfileEditorProps) {
  const t = useTranslations("Tutoring");
  const router = useRouter();

  const existingSubjects = profile?.subjects ?? [];

  const profileForm = useForm({
    defaultValues: {
      bio: profile?.bio ?? "",
      hourlyRate: profile?.hourlyRate ?? 2000,
      location: profile?.location ?? "",
    } as ProfileFormValues,
    validators: { onChange: profileSchema },
    onSubmit: async ({ value }) => {
      const result = profile
        ? await updateTutorProfileAction({
            bio: value.bio.trim(),
            hourlyRate: value.hourlyRate,
            location: value.location.trim() || null,
          })
        : await createTutorProfileAction({
            bio: value.bio.trim(),
            hourlyRate: value.hourlyRate,
            location: value.location.trim() || undefined,
          });
      if (!result.success) {
        toast.error(result.error?.message ?? t("saveFailed"));
        return;
      }
      toast.success(t("profileSaved"));
      router.refresh();
    },
  });

  const subjectForm = useForm({
    defaultValues: {
      subjectId: subjects.at(0)?.id ?? "",
      level: "2nde",
    } as SubjectFormValues,
    validators: { onChange: subjectSchema },
    onSubmit: async ({ value }) => {
      if (!profile) {
        toast.error(t("saveProfileFirst"));
        return;
      }
      const result = await addTutorSubjectAction({
        profileId: profile.id,
        subjectId: value.subjectId,
        level: value.level,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("addSubjectFailed"));
        return;
      }
      toast.success(t("subjectAdded"));
      router.refresh();
    },
  });

  async function handleRemoveSubject(sId: string) {
    if (!profile) return;
    const result = await removeTutorSubjectAction({
      profileId: profile.id,
      subjectId: sId,
    });
    if (!result.success) {
      toast.error(result.error?.message ?? t("removeSubjectFailed"));
      return;
    }
    toast.success(t("subjectRemoved"));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void profileForm.handleSubmit();
          }}
          className="space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-foreground">
            {t("profileBasics")}
          </h2>

          <profileForm.Field name="bio">
            {(field) => (
              <TextAreaField
                field={field}
                label={t("bio")}
                placeholder={t("bioPlaceholder")}
                rows={5}
                description={t("bioHint", {
                  count: ((field.state.value as string) ?? "").length,
                })}
              />
            )}
          </profileForm.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <profileForm.Field name="hourlyRate">
              {(field) => (
                <NumberField
                  field={field}
                  label={`${t("hourlyRate")} (FCFA)`}
                  min={0}
                  step={100}
                />
              )}
            </profileForm.Field>
            <profileForm.Field name="location">
              {(field) => (
                <TextField
                  field={field}
                  label={t("location")}
                  placeholder={t("locationPlaceholder")}
                />
              )}
            </profileForm.Field>
          </div>

          <profileForm.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <div className="flex justify-end">
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  <Save className="size-4" />
                  {t("saveProfile")}
                </SubmitButton>
              </div>
            )}
          </profileForm.Subscribe>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-base font-semibold text-foreground">
          {t("subjectsTaught")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("subjectsTaughtHint")}
        </p>

        {existingSubjects.length > 0 && (
          <ul className="mt-3 space-y-2">
            {existingSubjects.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="brand" size="sm">
                    {s.subject.name}
                  </Badge>
                  {s.level && (
                    <Badge variant="secondary" size="sm">
                      {s.level}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemoveSubject(s.subject.id)}
                >
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        )}

        {profile && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void subjectForm.handleSubmit();
            }}
            className="mt-4 grid gap-3 sm:grid-cols-3"
          >
            <subjectForm.Field name="subjectId">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("subject")}
                  placeholder={t("subject")}
                  options={subjects.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                />
              )}
            </subjectForm.Field>
            <subjectForm.Field name="level">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("level")}
                  options={LEVELS.map((l) => ({
                    value: l.value,
                    label: l.label,
                  }))}
                />
              )}
            </subjectForm.Field>
            <subjectForm.Subscribe
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
                    {t("addSubject")}
                  </SubmitButton>
                </div>
              )}
            </subjectForm.Subscribe>
          </form>
        )}
      </Card>
    </div>
  );
}
