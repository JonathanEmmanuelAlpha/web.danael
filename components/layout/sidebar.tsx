"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/user-store";
import { useSchoolStore } from "@/stores/school-store";
import { useLearningStore } from "@/stores/learning-store";
import { useUIStore } from "@/stores/ui-store";
import { getNavForRole, isPathActive, SECTION_LABELS } from "./nav-config";
import type { UserRole } from "@/types";

export interface SidebarProps {
  role: UserRole;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}

/**
 * Sidebar with role-based navigation (§6.3).
 * Used inside <DashboardShell /> (desktop) and mobile sheet.
 *
 * The sign-out button calls Clerk's `signOut()` and clears all local
 * Zustand stores before redirecting to /sign-in.
 *
 * Refonte "Aurora Navy":
 *  - glass-strong background with subtle halo-lime in the top-right corner
 *  - logo with a soft primary glow behind it
 *  - nav items: hover gradient primary/5 + glow primary-sm
 *  - active item: gradient primary/10 + left primary bar + glow primary-sm
 *  - section labels: uppercase tracking-wider with a decorative hairline
 *  - sign-out button: glass surface with coral hover
 */
export function Sidebar({
  role,
  variant = "desktop",
  onNavigate,
}: SidebarProps) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const sections = getNavForRole(role);
  const { signOut } = useClerk();
  const router = useRouter();

  function handleSignOut() {
    // 1. Clear all local Zustand stores so no stale data leaks between sessions.
    useUserStore.getState().clear();
    useSchoolStore.getState().clear();
    useLearningStore.getState().clear();
    useUIStore.getState().clear();

    // 2. Sign out from Clerk and redirect to /sign-in.
    //    In Clerk v7, signOut accepts a callback or an options object.
    //    We use the callback form for backward compatibility.
    if (signOut) {
      void signOut(() => {
        router.push("/sign-in");
      });
    } else {
      // Fallback: navigate to sign-in directly.
      window.location.href = "/sign-in";
    }
  }

  return (
    <div className="glass-strong relative flex h-full flex-col overflow-hidden border-r border-border">
      {/* Decorative halo — top-right corner */}
      <div
        aria-hidden
        className="halo-lime pointer-events-none absolute -right-20 -top-20 size-48 opacity-60"
      />

      {/* Logo */}
      <div className="relative z-10 flex h-16 items-center border-b border-border/60 px-5">
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-2xl bg-primary-500/20 blur-xl"
          />
          <Link
            href="/dashboard"
            onClick={onNavigate}
            aria-label="Danaël"
            className="relative block"
          >
            <Logo />
          </Link>
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="scrollbar-thin relative z-10 flex-1 px-3 py-4 h-30! overflow-hidden">
        <nav className="space-y-6">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-1.5">
              {section.titleKey && (
                <div className="flex items-center gap-2 px-3 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                    {t(SECTION_LABELS[section.titleKey] ?? section.titleKey)}
                  </span>
                  <span
                    aria-hidden
                    className="h-px flex-1 bg-gradient-to-r from-border-strong/60 to-transparent"
                  />
                </div>
              )}
              {section.items.map((item) => {
                const active = isPathActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 border-l-2",
                      active
                        ? "bg-gradient-to-r from-primary-500/10 to-transparent text-primary-700 dark:text-primary-300 border-primary-500"
                        : "text-muted-foreground hover:bg-primary-500/[0.06] hover:text-foreground border-transparent hover:border-primary-500",
                    )}
                    style={
                      active
                        ? { transitionTimingFunction: "var(--ease-smooth)" }
                        : undefined
                    }
                  >
                    <item.icon
                      className={cn(
                        "size-[18px] shrink-0 transition-colors",
                        active
                          ? "text-primary-500"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    {item.badge && (
                      <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:text-primary-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer: sign out */}
      <div className="relative z-10 border-t border-border/60 p-3">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "group w-full justify-start gap-3 rounded-lg border border-transparent text-muted-foreground transition-all duration-200",
            "hover:border-accent-coral-500/30 hover:bg-accent-coral-500/10 hover:text-accent-coral-400 hover:shadow-[0_0_12px_-4px_rgba(251,113,133,0.4)]",
          )}
          style={{ transitionTimingFunction: "var(--ease-smooth)" }}
          onClick={handleSignOut}
        >
          <LogOut className="size-[18px] transition-transform group-hover:translate-x-0.5" />
          {t("signOut")}
        </Button>
      </div>

      {/* Suppress unused variant warning — variant is reserved for future styling hooks */}
      {variant === "mobile" ? null : null}
    </div>
  );
}
