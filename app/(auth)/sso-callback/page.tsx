"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { getAuthStatusAction } from "@/server/actions/auth-status";

/**
 * §5.2 — SSO callback handler.
 *
 * Clerk redirects here after a successful OAuth handshake. We finalize the
 * session and redirect to the dashboard (or onboarding if incomplete).
 */
export default function SsoCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function finalize() {
      try {
        const status = await getAuthStatusAction();
        router.push(status.data?.onboardingCompleted ? "/dashboard" : "/onboarding/role");
        router.refresh();
      } catch {
        router.push("/sign-in");
      }
    }
    void finalize();
  }, [router]);

  return (
    <AuthLayout>
      <AuthPanel showLogo={false}>
        <div className="flex flex-col items-center gap-4 py-20">
          <Loader2 className="size-8 animate-spin text-primary-500" />
          <p className="text-sm text-white/60">Finalisation de la connexion…</p>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
