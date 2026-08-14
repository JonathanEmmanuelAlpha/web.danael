"use client";

import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSafeClerk, useSafeSignIn } from "@/lib/safe-clerk";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import { TextField, FormError } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { PasswordStrength } from "@/components/forms/password-strength";
import { SubmitButton } from "@/components/forms/submit-button";
import { getAuthStatusAction } from "@/server/actions/auth-status";
import type { ClerkError } from "@/types";

/**
 * §5.2 — Reset password page.
 * Completes the Clerk reset_password_email_code flow with code + new password.
 */
export default function ResetPasswordPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { fetchStatus, signIn } = useSafeSignIn();
  const isLoaded = fetchStatus === "idle";

  const { setActive } = useSafeClerk();

  const [globalError, setGlobalError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        code: z.string().min(6, t("verifyAccount.invalidCode")),
        password: z
          .string()
          .min(1, t("errors.passwordRequired"))
          .min(8, t("errors.passwordMin")),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: { code: "", password: "" },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      if (!isLoaded || !signIn) return;
      setGlobalError(null);

      try {
        // Vérification du code OTP
        await signIn.resetPasswordEmailCode.verifyCode({ code: value.code });

        // Soumission du nouveau mot de passe
        const result = await signIn.resetPasswordEmailCode.submitPassword({
          password: value.password,
        });

        // Remplacement de v7 pour setActive : On finalise le processus pour activer la session
        await signIn.finalize();

        if (result.error) setGlobalError(t("verifyAccount.invalidCode"));
        else toast.success(t("resetPassword.success"));

        const status = await getAuthStatusAction();

        if (status.success)
          router.push(
            status.data.onboardingCompleted ? "/dashboard" : "/onboarding/role",
          );

        // Save the session
        await setActive({ session: signIn.createdSessionId });
      } catch (err) {
        const clerkError = err as ClerkError;
        const msg =
          clerkError?.errors?.[0]?.longMessage ?? t("errors.unexpected");
        setGlobalError(msg);
      }
    },
  });

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up">
          <Link
            href="/sign-in"
            className="mb-4 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
          >
            <ArrowLeft className="size-4" />
            {t("twoFactor.back")}
          </Link>

          <AuthHeader title={t("resetPassword.title")} />

          <div className="mt-8">
            {globalError && (
              <FormError message={globalError} className="mb-4" />
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
              className="space-y-5"
              noValidate
            >
              <form.Field name="code">
                {(field) => (
                  <TextField
                    field={field}
                    label="Code"
                    placeholder={t("twoFactor.codePlaceholder")}
                  />
                )}
              </form.Field>

              <form.Field name="password">
                {(field) => (
                  <div>
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder={t("fields.passwordPlaceholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    />
                    <PasswordStrength password={field.state.value} />
                  </div>
                )}
              </form.Field>

              <SubmitButton
                form={form}
                idleLabel={t("resetPassword.title")}
                pendingLabel={t("actions.signingIn")}
                disabledExtra={!isLoaded}
                size="lg"
                className="danael-btn-primary w-full"
              />
            </form>
          </div>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
