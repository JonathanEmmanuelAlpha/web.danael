"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { ArrowRight, GraduationCap } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import {
  SelectField,
  NumberField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { completeStudentOnboardingAction } from "@/server/actions/onboarding";
import { LEVELS, SERIES } from "@/types";

const studentSchema = z.object({
  level: z.string().min(1, "Sélectionnez votre niveau"),
  series: z.string(),
  weeklyGoal: z.number().int().min(1).max(50),
});

/**
 * §5.2 — Student onboarding: level, series, weekly goal.
 */
export default function StudentOnboardingPage() {
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      level: "",
      series: "",
      weeklyGoal: 5,
    },
    validators: { onChange: studentSchema },
    onSubmit: async ({ value }) => {
      const result = await completeStudentOnboardingAction({
        level: value.level as (typeof LEVELS)[number],
        series: (value.series || undefined) as
          | (typeof SERIES)[number]
          | undefined,
        weeklyGoal: value.weeklyGoal,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Onboarding terminé ! Bienvenue 🎉");
      router.push("/dashboard");
    },
  });

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up w-full max-w-md">
          <AuthHeader
            icon={<GraduationCap className="size-7" />}
            title="Profil élève"
            subtitle="Personnalisez votre expérience d'apprentissage"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="mt-8 space-y-5"
          >
            <form.Field name="level">
              {(field) => (
                <SelectField
                  field={field}
                  label="Niveau scolaire"
                  placeholder="Sélectionnez votre niveau"
                  required
                  triggerClassName="danael-input"
                  options={LEVELS.map((lvl) => ({ value: lvl, label: lvl }))}
                />
              )}
            </form.Field>

            <form.Field name="series">
              {(field) => (
                <SelectField
                  field={field}
                  label="Série (optionnel)"
                  placeholder="Aucune"
                  triggerClassName="danael-input"
                  options={SERIES.map((s) => ({ value: s, label: s }))}
                />
              )}
            </form.Field>

            <form.Field name="weeklyGoal">
              {(field) => (
                <NumberField
                  field={field}
                  label="Objectif hebdomadaire (leçons)"
                  min={1}
                  max={50}
                  step={1}
                  inputClassName="danael-input"
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
                  {errors.length > 0 && (
                    <FormErrorBanner message="Veuillez corriger les erreurs ci-dessus" />
                  )}
                  <SubmitButton
                    pending={isSubmitting}
                    disabled={!canSubmit}
                    size="lg"
                    className="danael-btn-primary w-full"
                  >
                    Terminer
                    <ArrowRight className="size-5" />
                  </SubmitButton>
                </>
              )}
            </form.Subscribe>
          </form>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
