"use client";

import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSignIn, useClerk } from "@clerk/nextjs";
import { useSafeSignIn, useSafeClerk } from "@/lib/safe-clerk";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import Link from "next/link";
import { Mail, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader, AuthSecureFooter } from "@/components/auth/auth-header";
import { TextField, FormError, Divider } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { OAuthButtons } from "@/components/forms/oauth-buttons";
import { Button } from "@/components/ui/button";
import { getAuthStatusAction } from "@/server/actions/auth-status";
import type { ClerkError, OAuthStrategy } from "@/types";

/**
 * §5.2 — Sign-in page (refactored with reusable components).
 *
 * Changes from original:
 *  - useAuthRedirect() removed → router.push("/dashboard") explicit after success.
 *  - Reusable components: AuthLayout, AuthPanel, AuthHeader, TextField, PasswordInput,
 *    SubmitButton, OAuthButtons, FormError, Divider, AuthSecureFooter.
 *  - On success: fetch DB user → redirect to /onboarding/role if incomplete, else /dashboard.
 */
export default function SignInPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { fetchStatus, signIn } = useSafeSignIn();
  const isLoaded = fetchStatus === "idle";
  const { setActive } = useSafeClerk();

  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState<OAuthStrategy | null>(null);
  const [forgotPending, setForgotPending] = useState(false);
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const schema = useMemo(
    () =>
      z.object({
        identifier: z
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
    defaultValues: { identifier: "", password: "" },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      if (!isLoaded || !signIn) return;
      setGlobalError(null);
      setNeedsSecondFactor(false);

      try {
        await signIn.password({
          identifier: value.identifier,
          password: value.password,
        });

        if (signIn.status === "complete") {
          await signIn.finalize();
          await setActive({ session: signIn.createdSessionId });
          // Resolve redirect based on onboarding status (server action, client-safe).
          const status = await getAuthStatusAction();
          router.push(status.data?.onboardingCompleted ? "/dashboard" : "/onboarding/role");
          router.refresh();
        } else if (signIn.status === "needs_second_factor") {
          setNeedsSecondFactor(true);
          setGlobalError(t("errors.twoFactorRequired"));
        } else if (signIn.status === "needs_identifier") {
          setGlobalError(t("errors.invalidCredentials"));
        }
      } catch (err) {
        const clerkError = err as ClerkError;
        const msg = clerkError?.errors?.[0]?.longMessage ?? t("errors.unexpected");
        setGlobalError(msg);
      }
    },
  });

  const handleTwoFactorSubmit = async () => {
    if (!isLoaded || !signIn) return;
    setGlobalError(null);
    try {
      await signIn.mfa.verifyTOTP({ code: twoFactorCode });
      if (signIn.status === "complete") {
        await signIn.finalize();
        await setActive({ session: signIn.createdSessionId });
        const status = await getAuthStatusAction();
        router.push(status.data?.onboardingCompleted ? "/dashboard" : "/onboarding/role");
        router.refresh();
      }
    } catch (err) {
      const clerkError = err as ClerkError;
      const msg = clerkError?.errors?.[0]?.longMessage ?? t("errors.twoFactorInvalid");
      setGlobalError(msg);
    }
  };

  const handleForgot = () => {
    const email = form.state.values.identifier;
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!emailOk) {
      router.push("/forgot-password");
      return;
    }
    router.push(`/forgot-password?email=${encodeURIComponent(email)}`);
  };

  const handleOAuth = async (strategy: OAuthStrategy) => {
    if (!isLoaded || !signIn) return;
    setOauthPending(strategy);
    setGlobalError(null);
    try {
      await signIn.sso({
        strategy,
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectCallbackUrl: `${window.location.origin}/dashboard`,
      });
    } catch (err) {
      const clerkError = err as ClerkError;
      const msg = clerkError?.errors?.[0]?.longMessage ?? t("errors.oauthFailed");
      setGlobalError(msg);
      setOauthPending(null);
    }
  };

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up">
          <AuthHeader title={`${t("signIn.title")} 👋`} subtitle={t("signIn.subtitle")} />

          <div className="mt-8">
            {globalError && <FormError message={globalError} className="mb-4" />}

            {!needsSecondFactor ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
                className="space-y-5"
                noValidate
              >
                <form.Field name="identifier">
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
                        autoComplete="current-password"
                        placeholder={t("fields.passwordPlaceholder")}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={
                          field.state.meta.isTouched && field.state.meta.errors.length > 0
                        }
                      />
                    </div>
                  )}
                </form.Field>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgot}
                    disabled={forgotPending}
                    className="text-sm font-medium text-primary-600 transition hover:text-primary-700 hover:underline disabled:opacity-50 dark:text-primary-400"
                  >
                    {t("actions.forgotPassword")}
                  </button>
                </div>

                <SubmitButton
                  form={form}
                  idleLabel={t("actions.signIn")}
                  pendingLabel={t("actions.signingIn")}
                  disabledExtra={!isLoaded}
                  size="lg"
                  className="danael-btn-primary w-full"
                />
              </form>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-white/70">{t("twoFactor.instruction")}</p>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={t("twoFactor.codePlaceholder")}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="h-12 rounded-xl text-sm"
                />
                <Button
                  variant="brand"
                  size="lg"
                  onClick={handleTwoFactorSubmit}
                  disabled={!twoFactorCode || !isLoaded}
                  className="w-full"
                >
                  {t("twoFactor.verify")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNeedsSecondFactor(false);
                    setTwoFactorCode("");
                    setGlobalError(null);
                  }}
                  className="w-full text-sm"
                >
                  {t("twoFactor.back")}
                </Button>
              </div>
            )}

            <Divider label={t("actions.orContinueWith")} className="mt-6" />

            <OAuthButtons
              onOAuth={handleOAuth}
              pendingStrategy={oauthPending}
              disabled={!isLoaded}
              className="mt-5"
            />

            <p className="mt-7 text-center text-sm text-white/60">
              {t("actions.createAccountPrompt")}{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-primary-600 hover:underline dark:text-primary-400"
              >
                {t("actions.createAccount")}
              </Link>
            </p>

            <AuthSecureFooter />
          </div>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
