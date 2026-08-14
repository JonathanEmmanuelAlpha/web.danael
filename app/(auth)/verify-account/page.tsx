"use client";

import { useEffect, useRef, useState } from "react";
import { useSafeClerk, useSafeSignUp } from "@/lib/safe-clerk";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";

const RESEND_COOLDOWN = 60;

/**
 * §5.2 — Verify account: email OTP with resend cooldown.
 *
 * Changes from original:
 *  - useAuthRedirect() removed → router.push("/onboarding/role") explicit.
 *  - TYPO FIX: /oboarding/role → /onboarding/role.
 *  - Reusable components used (AuthLayout, AuthPanel, AuthHeader).
 */
export default function VerifyAccountPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const { setActive } = useSafeClerk();
  const { signUp, fetchStatus } = useSafeSignUp();
  const isLoaded = fetchStatus === "idle";

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  // useRef prevents the StrictMode double-trigger of useEffect.
  const hasSentCode = useRef(false);

  useEffect(() => {
    const tick = setInterval(
      () => setCooldown((c) => (c > 0 ? c - 1 : 0)),
      1000,
    );
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!isLoaded || !signUp || pending) return;

    // If email is already verified, redirect immediately.
    if (signUp.status === "complete") {
      void finalize();
      return;
    }

    // Auto-send the code on page load.
    void sendVerificationCode();
  }, [isLoaded, signUp, pending]);

  async function sendVerificationCode() {
    if (!signUp || hasSentCode.current) return;
    hasSentCode.current = true;
    setPending(true);

    try {
      await signUp.verifications.sendEmailCode();
      toast.info(t("verifyAccount.sendCode"));
    } catch {
      toast.error(t("errors.unexpected"));
      hasSentCode.current = false; // Allow retry on network failure.
    } finally {
      setPending(false);
    }
  }

  async function finalize() {
    await signUp?.finalize();
    await setActive({ session: signUp?.createdSessionId });
    toast.success(t("verifyAccount.success"));
    // FIXED: /oboarding/role → /onboarding/role (typo in original).
    router.push("/onboarding/role");
  }

  const verify = async () => {
    if (!isLoaded || !signUp) return;
    setPending(true);
    try {
      const completeSignUp = await signUp.verifications.verifyEmailCode({
        code,
      });

      if (!completeSignUp.error) {
        await signUp.finalize();
        await setActive({ session: signUp.createdSessionId });
        toast.success(t("verifyAccount.success"));
        router.push("/onboarding/role");
      } else if (completeSignUp.error.code === "form_code_incorrect") {
        toast.error(t("verifyAccount.invalidCode"));
      }
    } catch {
      toast.error(t("verifyAccount.invalidCode"));
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    if (!isLoaded || !signUp || pending) return;
    setCooldown(RESEND_COOLDOWN);
    hasSentCode.current = false;
    await sendVerificationCode();
  };

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up text-center">
          <AuthHeader
            icon={<MailCheck className="size-7" />}
            title={t("verifyAccount.title")}
            subtitle={
              <>
                {t("verifyAccount.subtitle")}{" "}
                <span className="font-semibold text-white">
                  {signUp?.emailAddress}
                </span>
              </>
            }
          />
        </div>

        <div className="mt-8 space-y-5">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="danael-input h-12 w-14! p-0 text-center text-lg font-bold rounded-none!"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            variant="brand"
            size="lg"
            disabled={code.length !== 6 || pending || !isLoaded}
            onClick={verify}
            className="danael-btn-primary w-full"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              t("verifyAccount.verify")
            )}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || pending}
              className="font-medium text-primary-600 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-400"
            >
              {cooldown > 0
                ? t("verifyAccount.resendIn", { seconds: cooldown })
                : t("verifyAccount.resend")}
            </button>
            <Link
              href="/sign-up"
              className="text-white/50 transition hover:text-white"
            >
              {t("verifyAccount.changeEmail")}
            </Link>
          </div>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
