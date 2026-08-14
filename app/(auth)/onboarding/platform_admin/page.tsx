"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { ShieldCheck, KeyRound, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import {
  TextField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { completeAdminOnboardingAction } from "@/server/actions/onboarding";

const adminSchema = z.object({
  authorizationCode: z
    .string()
    .min(8, "Le code doit contenir au moins 8 caractères")
    .max(64, "Le code est trop long")
    .regex(/^[A-Z0-9_-]+$/i, "Caractères autorisés : A-Z, 0-9, -, _"),
});

type AdminValues = z.infer<typeof adminSchema>;

/**
 * §5.2 — platform_admin onboarding: authorization code activation.
 *
 * The platform admin must provide a valid authorization code provided by
 * the platform operator to activate their account.
 */
export default function PlatformAdminOnboardingPage() {
  const t = useTranslations("Onboarding.platformAdmin");
  const router = useRouter();

  const form = useForm({
    defaultValues: { authorizationCode: "" } as AdminValues,
    validators: { onChange: adminSchema },
    onSubmit: async ({ value }) => {
      const result = await completeAdminOnboardingAction({
        role: "platform_admin",
        authorizationCode: value.authorizationCode.toUpperCase().trim(),
      });
      if (!result.success) {
        toast.error(result.error.message ?? t("invalidCode"));
        return;
      }
      toast.success(t("activated"));
      router.push("/admin/dashboard");
    },
  });

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up w-full max-w-md">
          <AuthHeader
            icon={<ShieldCheck className="size-7" />}
            title={t("title")}
            subtitle={t("subtitle")}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="mt-8 space-y-5"
          >
            <form.Field name="authorizationCode">
              {(field) => (
                <TextField
                  field={field}
                  label={t("authorizationCode")}
                  description={t("authorizationCodeHint")}
                  placeholder="EX: ADMN-XXXX-XXXX"
                  required
                  autoFocus
                  leading={<KeyRound className="size-5" />}
                  inputClassName="font-mono uppercase tracking-widest danael-input"
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
                    <FormErrorBanner message={t("invalidCode")} />
                  )}
                  <SubmitButton
                    pending={isSubmitting}
                    disabled={!canSubmit}
                    size="lg"
                    className="danael-btn-primary w-full"
                  >
                    {t("activate")}
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
