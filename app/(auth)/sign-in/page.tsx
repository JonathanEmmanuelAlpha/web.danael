"use client";

import { useMemo, useState } from "react";
import { useSafeSignIn, useSafeClerk } from "@/lib/safe-clerk";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import Link from "next/link";
import { Mail, Smartphone, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader, AuthSecureFooter } from "@/components/auth/auth-header";
import { TextField, FormError, Divider } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "@/components/forms/oauth-buttons";
import { Button } from "@/components/ui/button";
import { getAuthStatusAction } from "@/server/actions/auth-status";
import type { ClerkError, OAuthStrategy } from "@/types";
import { useAppForm } from "@/components/forms/form-hook";
import { toast } from "sonner";

/**
 * §5.2 — Sign-in page — Gère tous les statuts Clerk :
 * - needs_identifier  → formulaire email/password
 * - needs_first_factor → formulaire email/password (ou SSO)
 * - needs_second_factor → MFA (TOTP, etc.)
 * - needs_client_trust → Device Trust (email_code ou phone_code)
 * - complete → finalisation + redirection
 */
export default function SignInPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { fetchStatus, signIn } = useSafeSignIn();
  const isLoaded = fetchStatus === "idle";
  const { setActive } = useSafeClerk();

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState<OAuthStrategy | null>(null);

  // --- États pour MFA (needs_second_factor) ---
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // --- États pour Device Trust (needs_client_trust) ---
  const [needsClientTrust, setNeedsClientTrust] = useState(false);
  const [trustCode, setTrustCode] = useState("");
  const [trustStrategy, setTrustStrategy] = useState<
    "email_code" | "phone_code" | null
  >(null);

  // --- Schéma de validation ---
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

  const form = useAppForm({
    defaultValues: { identifier: "", password: "" },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      if (!isLoaded || !signIn) return;
      setGlobalError(null);
      setNeedsSecondFactor(false);
      setNeedsClientTrust(false);

      try {
        // 1. Tentative de connexion avec email + password
        await signIn.password({
          identifier: value.identifier,
          password: value.password,
        });

        // 2. Gestion des différents statuts
        await handleSignInStatus();
      } catch (err) {
        const clerkError = err as ClerkError;
        const msg =
          clerkError?.errors?.[0]?.longMessage ?? t("errors.unexpected");
        setGlobalError(msg);
      }
    },
  });

  // --- Gestion centralisée des statuts après signIn.password() ---
  const handleSignInStatus = async () => {
    if (!signIn) return;

    const status = signIn.status;

    switch (status) {
      case "complete":
        await finalizeSignIn();
        break;

      case "needs_second_factor":
        // MFA activé → l'utilisateur doit entrer un code TOTP
        setNeedsSecondFactor(true);
        setGlobalError(t("errors.twoFactorRequired"));
        break;

      case "needs_client_trust":
        // Device Trust → envoyer un code par email ou SMS
        await handleClientTrust();
        break;

      case "needs_identifier":
        setGlobalError(t("errors.invalidCredentials"));
        break;

      case "needs_first_factor":
        // Peut arriver avec des strategies SSO, on laisse le formulaire
        setGlobalError(t("errors.invalidCredentials"));
        break;

      default:
        console.warn("Statut non géré :", status);
        setGlobalError(t("errors.unexpected"));
    }
  };

  // --- Device Trust : préparer et envoyer le code ---
  const handleClientTrust = async () => {
    if (!signIn) return;

    // Récupérer les facteurs supportés pour Device Trust
    const supportedFactors = signIn.supportedSecondFactors || [];

    // Priorité : email_code > phone_code
    const emailFactor = supportedFactors.find(
      (f: any) => f.strategy === "email_code",
    );
    const phoneFactor = supportedFactors.find(
      (f: any) => f.strategy === "phone_code",
    );

    if (emailFactor) {
      setTrustStrategy("email_code");
      await signIn.mfa.sendEmailCode();
      setNeedsClientTrust(true);
      toast.info(t("clientTrust.emailSent"));
    } else if (phoneFactor) {
      setTrustStrategy("phone_code");
      await signIn.mfa.sendPhoneCode();
      setNeedsClientTrust(true);
      setGlobalError(t("clientTrust.smsSent"));
    } else {
      setGlobalError(t("clientTrust.noMethodAvailable"));
    }
  };

  // --- Vérification du code Device Trust ---
  const handleTrustVerification = async () => {
    if (!signIn || !trustStrategy || !trustCode) return;
    setGlobalError(null);

    try {
      if (trustStrategy === "email_code") {
        await signIn.mfa.verifyEmailCode({ code: trustCode });
      } else if (trustStrategy === "phone_code") {
        await signIn.mfa.verifyPhoneCode({ code: trustCode });
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
      } else {
        setGlobalError(t("clientTrust.invalidCode"));
      }
    } catch (err) {
      const clerkError = err as ClerkError;
      const msg =
        clerkError?.errors?.[0]?.longMessage ??
        t("clientTrust.verificationFailed");
      setGlobalError(msg);
    }
  };

  // --- Vérification MFA (TOTP) ---
  const handleTwoFactorSubmit = async () => {
    if (!isLoaded || !signIn) return;
    setGlobalError(null);

    try {
      await signIn.mfa.verifyTOTP({ code: twoFactorCode });

      if (signIn.status === "complete") {
        await finalizeSignIn();
      } else {
        setGlobalError(t("errors.twoFactorInvalid"));
      }
    } catch (err) {
      const clerkError = err as ClerkError;
      const msg =
        clerkError?.errors?.[0]?.longMessage ?? t("errors.twoFactorInvalid");
      setGlobalError(msg);
    }
  };

  // --- Finalisation et redirection ---
  const finalizeSignIn = async () => {
    if (!signIn) return;

    await signIn.finalize();
    await setActive({ session: signIn.createdSessionId });

    // Vérifier le statut d'onboarding via server action
    const status = await getAuthStatusAction();

    if (status.success) {
      router.push(
        status.data.onboardingCompleted ? "/settings" : "/onboarding/role",
      );
    } else {
      router.push("/dashboard");
    }

    router.refresh();
  };

  // --- Mot de passe oublié ---
  const handleForgot = () => {
    const email = form.state.values.identifier;
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    const target = emailOk
      ? `/forgot-password?email=${encodeURIComponent(email)}`
      : "/forgot-password";
    router.push(target);
  };

  // --- OAuth ---
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
      const msg =
        clerkError?.errors?.[0]?.longMessage ?? t("errors.oauthFailed");
      setGlobalError(msg);
      setOauthPending(null);
    }
  };

  // ============================================================
  // RENDU
  // ============================================================

  // --- Écran Device Trust (needs_client_trust) ---
  if (needsClientTrust) {
    return (
      <AuthLayout>
        <AuthPanel>
          <div className="animate-fade-up">
            <AuthHeader
              title={t("clientTrust.title")}
              subtitle={t("clientTrust.subtitle")}
              icon={<ShieldCheck className="size-8 text-primary-500" />}
            />

            <div className="mt-8 space-y-5">
              {globalError && (
                <FormError message={globalError} className="mb-4" />
              )}

              <p className="text-sm text-white/70">
                {trustStrategy === "email_code"
                  ? t("clientTrust.checkEmail")
                  : t("clientTrust.checkSms")}
              </p>

              <Input
                type="text"
                inputMode="numeric"
                placeholder={t("clientTrust.codePlaceholder")}
                value={trustCode}
                onChange={(e) => setTrustCode(e.target.value)}
                className="h-12 rounded-xl text-sm"
              />

              <Button
                variant="brand"
                size="lg"
                onClick={handleTrustVerification}
                disabled={!trustCode || !isLoaded}
                className="w-full"
              >
                {t("clientTrust.verify")}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNeedsClientTrust(false);
                  setTrustCode("");
                  setTrustStrategy(null);
                  setGlobalError(null);
                }}
                className="w-full text-sm"
              >
                {t("clientTrust.back")}
              </Button>
            </div>

            <AuthSecureFooter />
          </div>
        </AuthPanel>
      </AuthLayout>
    );
  }

  // --- Écran MFA (needs_second_factor) ---
  if (needsSecondFactor) {
    return (
      <AuthLayout>
        <AuthPanel>
          <div className="animate-fade-up">
            <AuthHeader
              title={t("twoFactor.title")}
              subtitle={t("twoFactor.subtitle")}
            />

            <div className="mt-8 space-y-5">
              {globalError && (
                <FormError message={globalError} className="mb-4" />
              )}

              <p className="text-sm text-white/70">
                {t("twoFactor.instruction")}
              </p>

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

            <AuthSecureFooter />
          </div>
        </AuthPanel>
      </AuthLayout>
    );
  }

  // --- Écran principal : formulaire email/password ---
  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up">
          <AuthHeader
            title={`${t("signIn.title")} 👋`}
            subtitle={t("signIn.subtitle")}
          />

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
              <form.AppField name="identifier">
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
              </form.AppField>

              <form.AppField name="password">
                {(field) => (
                  <div>
                    <PasswordInput
                      autoComplete="current-password"
                      placeholder={t("fields.passwordPlaceholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    />
                  </div>
                )}
              </form.AppField>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgot}
                  className="text-sm font-medium text-primary-600 transition hover:text-primary-700 hover:underline disabled:opacity-50 dark:text-primary-400"
                >
                  {t("actions.forgotPassword")}
                </button>
              </div>

              <form.AppForm>
                <form.SubmitButton
                  idleLabel={t("actions.signIn")}
                  pendingLabel={t("actions.signingIn")}
                  disabledExtra={!isLoaded}
                  size="lg"
                  className="danael-btn-primary w-full"
                />
              </form.AppForm>
            </form>

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
