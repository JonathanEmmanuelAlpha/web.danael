"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Baby, Link as LinkIcon } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import {
  TextField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { completeParentOnboardingAction } from "@/server/actions/onboarding";

const parentSchema = z.object({
  childCode: z
    .string()
    .min(6, "Le code doit contenir au moins 6 caractères")
    .optional()
    .or(z.literal("")),
});

type ParentValues = z.infer<typeof parentSchema>;

/**
 * §5.2 — Parent onboarding: link a child via code.
 */
export default function ParentOnboardingPage() {
  const router = useRouter();

  const form = useForm({
    defaultValues: { childCode: "" } as ParentValues,
    validators: { onChange: parentSchema },
    onSubmit: async ({ value }) => {
      const result = await completeParentOnboardingAction({
        childCode: value.childCode || undefined,
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
            icon={<Baby className="size-7" />}
            title="Profil parent"
            subtitle="Liez votre compte à celui de votre enfant"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="mt-8 space-y-5"
          >
            <form.Field name="childCode">
              {(field) => (
                <TextField
                  field={field}
                  label="Code de liaison enfant (optionnel)"
                  placeholder="Ex: ABC123"
                  leading={<LinkIcon className="size-5" />}
                  description="Vous pouvez aussi lier votre enfant plus tard depuis votre espace parent."
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
