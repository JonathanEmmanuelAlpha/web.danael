"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Users, Plus, X } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import {
  TextAreaField,
  NumberField,
  TextField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { completeTutorOnboardingAction } from "@/server/actions/onboarding";

const COMMON_SUBJECTS = [
  "Mathématiques",
  "Physique",
  "Chimie",
  "SVT",
  "Français",
  "Anglais",
];

const tutorSchema = z.object({
  bio: z.string().min(20, "Décrivez votre parcours en au moins 20 caractères"),
  hourlyRate: z.number().min(500, "Le tarif minimum est de 500 FCFA"),
  location: z.string().min(2, "Indiquez votre zone"),
});

type TutorValues = z.infer<typeof tutorSchema>;

/**
 * §5.2 — Tutor onboarding: bio, rate, location, subjects.
 */
export default function TutorOnboardingPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      bio: "",
      hourlyRate: 2000,
      location: "",
    } as TutorValues,
    validators: { onChange: tutorSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      if (subjects.length === 0) {
        setServerError("Sélectionnez au moins une matière");
        return;
      }
      const result = await completeTutorOnboardingAction({
        ...value,
        subjects,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Onboarding terminé ! Bienvenue 🎉");
      router.push("/dashboard");
    },
  });

  function toggleSubject(s: string) {
    setSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up w-full max-w-md">
          <AuthHeader
            icon={<Users className="size-7" />}
            title="Profil tuteur"
            subtitle="Renseignez votre profil pour commencer"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="mt-8 space-y-5"
          >
            <form.Field name="bio">
              {(field) => (
                <TextAreaField
                  field={field}
                  label="Présentation"
                  placeholder="Décrivez votre parcours et votre approche pédagogique…"
                  rows={4}
                  required
                  inputClassName="danael-input"
                />
              )}
            </form.Field>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="hourlyRate">
                {(field) => (
                  <NumberField
                    field={field}
                    label="Tarif horaire (FCFA)"
                    min={500}
                    step={500}
                    required
                    inputClassName="danael-input"
                  />
                )}
              </form.Field>
              <form.Field name="location">
                {(field) => (
                  <TextField
                    field={field}
                    label="Zone"
                    placeholder="Yaoundé / En ligne"
                    required
                    inputClassName="danael-input"
                  />
                )}
              </form.Field>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Matières</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_SUBJECTS.map((s) => {
                  const isSelected = subjects.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                        isSelected
                          ? "border-primary-500 bg-primary-500/20 text-primary-400"
                          : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                      }`}
                    >
                      {isSelected ? <X className="size-3" /> : <Plus className="size-3" />}
                      {s}
                    </button>
                  );
                })}
              </div>
              {subjects.length > 0 && (
                <p className="text-xs text-white/40">
                  {subjects.length} matière(s) sélectionnée(s)
                </p>
              )}
            </div>

            <FormErrorBanner message={serverError} />

            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting] as const
              }
            >
              {([canSubmit, isSubmitting]) => (
                <SubmitButton
                  pending={isSubmitting}
                  disabled={!canSubmit}
                  size="lg"
                  className="danael-btn-primary w-full"
                >
                  Terminer
                </SubmitButton>
              )}
            </form.Subscribe>
          </form>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
