"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  GraduationCap,
  School,
  Users,
  Baby,
  BookOpen,
  ShieldCheck,
  LifeBuoy,
  ScanSearch,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setRoleAction } from "@/server/actions/onboarding";
import type { UserRole } from "@/types";

const ROLE_CARDS: Array<{
  role: UserRole;
  labelKey:
    | "student"
    | "teacher"
    | "school"
    | "parent"
    | "tutor"
    | "platformAdmin"
    | "contentModerator"
    | "support";
  href: string;
  Icon: typeof GraduationCap;
  accent: string;
}> = [
  {
    role: "student",
    labelKey: "student",
    href: "/onboarding/profile?target=student",
    Icon: GraduationCap,
    accent: "from-primary-500/20 to-primary-600/10 border-primary-500/30",
  },
  {
    role: "teacher",
    labelKey: "teacher",
    href: "/onboarding/profile?target=teacher",
    Icon: BookOpen,
    accent: "from-blue-500/20 to-blue-600/10 border-blue-400/30",
  },
  {
    role: "school_admin",
    labelKey: "school",
    href: "/onboarding/profile?target=school",
    Icon: School,
    accent: "from-purple-500/20 to-purple-600/10 border-purple-400/30",
  },
  {
    role: "parent",
    labelKey: "parent",
    href: "/onboarding/profile?target=parent",
    Icon: Baby,
    accent: "from-pink-500/20 to-pink-600/10 border-pink-400/30",
  },
  {
    role: "tutor",
    labelKey: "tutor",
    href: "/onboarding/profile?target=tutor",
    Icon: Users,
    accent: "from-amber-500/20 to-amber-600/10 border-amber-400/30",
  },
  {
    role: "platform_admin",
    labelKey: "platformAdmin",
    href: "/onboarding/platform_admin",
    Icon: ShieldCheck,
    accent: "from-emerald-500/20 to-emerald-600/10 border-emerald-400/30",
  },
  {
    role: "content_moderator",
    labelKey: "contentModerator",
    href: "/onboarding/content_moderator",
    Icon: ScanSearch,
    accent: "from-rose-500/20 to-rose-600/10 border-rose-400/30",
  },
  {
    role: "support",
    labelKey: "support",
    href: "/onboarding/support",
    Icon: LifeBuoy,
    accent: "from-cyan-500/20 to-cyan-600/10 border-cyan-400/30",
  },
];

/**
 * §5.2 — Onboarding step 1: role selection.
 */
export default function OnboardingRolePage() {
  const t = useTranslations("Onboarding.role");
  const router = useRouter();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [pending, setPending] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setPending(true);
    const result = await setRoleAction(selected);
    if (!result.success) {
      toast.error(result.error.message);
      setPending(false);
      return;
    }
    // Navigate to the role-specific onboarding form.
    const card = ROLE_CARDS.find((c) => c.role === selected);
    router.push(card?.href ?? `/onboarding/profile?target=${selected}`);
  }

  return (
    <AuthLayout>
      <AuthPanel>
        <div className="animate-fade-up w-full max-w-2xl">
          <AuthHeader title={t("title")} subtitle={t("subtitle")} />

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {ROLE_CARDS.map(({ role, labelKey, Icon, accent }) => {
              const isSelected = selected === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelected(role)}
                  className={cn(
                    "group relative flex items-center gap-4 rounded-2xl border bg-gradient-to-br p-5 text-left transition-all",
                    accent,
                    isSelected
                      ? "ring-2 ring-primary-500 ring-offset-2 ring-offset-secondary-700"
                      : "hover:scale-[1.02]",
                  )}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="size-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">{t(labelKey)}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary-500">
                      <svg viewBox="0 0 12 12" className="size-3 text-white">
                        <path
                          d="M10 3L4.5 8.5L2 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="brand"
            size="lg"
            disabled={!selected || pending}
            onClick={handleContinue}
            className="danael-btn-primary mt-6 w-full"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                {t("continue")}
                <ArrowRight className="size-5" />
              </>
            )}
          </Button>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
