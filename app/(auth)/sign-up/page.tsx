"use client";

import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSignUp, useClerk } from "@clerk/nextjs";
import { useSafeSignUp, useSafeClerk } from "@/lib/safe-clerk";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader, AuthSecureFooter } from "@/components/auth/auth-header";
import { TextField, FormError, Divider } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { PasswordStrength } from "@/components/forms/password-strength";
import { SubmitButton } from "@/components/forms/submit-button";
import { OAuthButtons } from "@/components/forms/oauth-buttons";
import type { ClerkError, OAuthStrategy } from "@/types";

/**
 * §5.2 — Sign-up page (refactored with reusable components).
 *
 * Changes from original:
 *  - useAuthRedirect() removed → router.push("/verify-account") explicit.
 *  - Reusable components used throughout.
 *  - On success: redirect to /verify-account (email verification step).
 */
export default function SignUpPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { fetchStatus, signUp } = useSafeSignUp();
  const isLoaded = fetchStatus !== "fetching";
  const { setActive } = useSafeClerk();

  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState<OAuthStrategy | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("errors.emailRequired"))
          .email(t("errors.emailInvalid")),
        password: z
          .string()
          .min(1, t("errors.passwordRequired"))
          .min(8, t("errors.passwordMin")),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      if (!isLoaded || !signUp) return;
      setGlobalError(null);

      try {
        // 1. Create the account (Clerk reads the captcha token from #clerk-captcha).
        await signUp.create({
          emailAddress: value.email,
          password: value.password,
        });

        // 2. Trigger the email OTP immediately (so the user receives it
        //    before arriving on /verify-account).
        await signUp.verifications.sendEmailCode();

        if (signUp.status === "complete") {
          await signUp.finalize();
          await setActive({ session: signUp.createdSessionId });
          router.push("/dashboard");
          router.refresh();
        } else if (signUp.status === "missing_requirements") {
          // Email verification required → go to verify-account.
          router.push("/verify-account");
        } else {
          setGlobalError(t("errors.unexpected"));
        }
      } catch (err) {
        const clerkError = err as ClerkError;

        // Specific handling for captcha failure.
        const isCaptchaError = clerkError?.errors?.some((e) =>
          e.longMessage?.toLowerCase().includes("captcha"),
        );
        if (isCaptchaError) {
          toast.error(t("errors.captchatFailed"));
          return;
        }

        const msg = clerkError?.errors?.[0]?.longMessage ?? t("errors.unexpected");
        setGlobalError(msg);
      }
    },
  });

  const handleOAuth = async (strategy: OAuthStrategy) => {
    if (!isLoaded || !signUp) return;
    setOauthPending(strategy);
    setGlobalError(null);
    try {
      await signUp.sso({
        strategy,
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectCallbackUrl: `${window.location.origin}/dashboard`,
      });
    } catch (err) {
      const clerkError = err as ClerkError;
      const msg = clerkError?.errors?.[0]?.longMessage ?? t("errors.oauthFailed");
      toast.error(msg);
      setOauthPending(null);
    }
  };

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up">
          <AuthHeader title={t("signUp.title")} subtitle={t("signUp.subtitle")} />

          <div className="mt-8">
            {globalError && <FormError message={globalError} className="mb-4" />}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
              className="space-y-5"
              noValidate
            >
              <form.Field name="email">
                {(field) => (
                  <TextField
                    field={field}
                    label={t("fields.emailPlaceholder")}
                    hideLabel
                    type="email"
                    placeholder={t("fields.emailPlaceholder")}
                    leftIcon={<Mail className="size-5" />}
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
                        field.state.meta.isTouched && field.state.meta.errors.length > 0
                      }
                    />
                    <PasswordStrength password={field.state.value} />
                  </div>
                )}
              </form.Field>

              {/* Clerk's CAPTCHA widget */}
              <div id="clerk-captcha" data-cl-theme="dark" data-cl-size="flexible" />

              <SubmitButton
                form={form}
                idleLabel={t("actions.signUp")}
                pendingLabel={t("actions.signingUp")}
                disabledExtra={!isLoaded}
                size="lg"
                className="danael-btn-primary w-full"
              />
            </form>

            <Divider label={t("actions.orContinueWith")} className="mt-6" />

            <OAuthButtons
              onOAuth={handleOAuth}
              pendingStrategy={oauthPending}
              disabled={!isLoaded}
              className="mt-5"
            />

            <p className="mt-7 text-center text-sm text-white/60">
              {t("actions.alreadyHaveAccount")}{" "}
              <Link
                href="/sign-in"
                className="font-semibold text-primary-600 hover:underline dark:text-primary-400"
              >
                {t("actions.signInLink")}
              </Link>
            </p>

            <AuthSecureFooter />
          </div>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
