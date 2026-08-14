"use client";

import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSafeSignIn } from "@/lib/safe-clerk";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import { TextField, FormError } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import type { ClerkError } from "@/types";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const { fetchStatus, signIn } = useSafeSignIn();
  const isLoaded = fetchStatus === "idle";
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";

  const [globalError, setGlobalError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("errors.emailRequired"))
          .email(t("errors.emailInvalid")),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: { email: prefillEmail },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      if (!isLoaded || !signIn) return;
      setGlobalError(null);

      try {
        await signIn.create({
          identifier: value.email,
        });

        await signIn.resetPasswordEmailCode.sendCode();

        toast.success(t("resetPassword.emailSent"));
        window.location.href = `/reset-password?email=${encodeURIComponent(value.email)}`;
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

              <SubmitButton
                form={form}
                idleLabel={t("actions.signIn")}
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
