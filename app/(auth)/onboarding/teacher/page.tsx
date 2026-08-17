"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { BookOpen, Plus, X } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import {
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { completeTeacherOnboardingAction } from "@/server/actions/onboarding";

const COMMON_SUBJECTS = [
  "Mathématiques",
  "Physique",
  "Chimie",
  "SVT",
  "Français",
  "Anglais",
  "Histoire-Géographie",
  "Philosophie",
  "Informatique",
  "EPS",
];

const teacherSchema = z.object({
  subjects: z.array(z.string()).min(1, "Sélectionnez au moins une matière"),
});

type TeacherValues = z.infer<typeof teacherSchema>;

/**
 * §5.2 — Teacher onboarding: subjects taught.
 */
export default function TeacherOnboardingPage() {
  const router = useRouter();

  const form = useForm({
    defaultValues: { subjects: [] as string[] } as TeacherValues,
    validators: { onChange: teacherSchema },
    onSubmit: async ({ value }) => {
      const result = await completeTeacherOnboardingAction({
        subjects: value.subjects,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Onboarding terminé ! Bienvenue 🎉");
      router.push("/teacher/dashboard");
    },
  });

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up w-full max-w-md">
          <AuthHeader
            icon={<BookOpen className="size-7" />}
            title="Profil enseignant"
            subtitle="Sélectionnez les matières que vous enseignez"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="mt-8 space-y-5"
          >
            <form.Field name="subjects">
              {(field) => {
                const selected = (field.state.value as string[]) ?? [];
                const toggle = (s: string) => {
                  field.handleChange(
                    (selected.includes(s)
                      ? selected.filter((x) => x !== s)
                      : [...selected, s]) as never,
                  );
                };
                return (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      Matières enseignées
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_SUBJECTS.map((s) => {
                        const isSelected = selected.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggle(s)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                              isSelected
                                ? "border-primary-500 bg-primary-500/20 text-primary-400"
                                : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                            }`}
                          >
                            {isSelected && <X className="size-3" />}
                            {!isSelected && <Plus className="size-3" />}
                            {s}
                          </button>
                        );
                      })}
                    </div>
                    {selected.length > 0 && (
                      <p className="text-xs text-white/40">
                        {selected.length} matière(s) sélectionnée(s)
                      </p>
                    )}
                  </div>
                );
              }}
            </form.Field>

            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting, state.errors] as const
              }
            >
              {([canSubmit, isSubmitting, errors]) => (
                <>
                  {errors.length > 0 && (
                    <FormErrorBanner message="Sélectionnez au moins une matière" />
                  )}
                  <SubmitButton
                    pending={isSubmitting}
                    disabled={!canSubmit}
                    size="lg"
                    className="danael-btn-primary w-full"
                  >
                    Terminer
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
