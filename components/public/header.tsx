"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn, getUserDashboardRoadByRole } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { LanguageThemeBar } from "./language-theme-bar";
import { Menu, X, ArrowRight } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useUserStore } from "@/stores/user-store";

interface NavLink {
  href: string;
  labelKey: string;
}

const LINKS: NavLink[] = [
  { href: "/how-it-works", labelKey: "howItWorks" },
  { href: "/pricing", labelKey: "pricing" },
  { href: "/schools", labelKey: "schools" },
  { href: "/testimonials", labelKey: "testimonials" },
  { href: "/faq", labelKey: "faq" },
  { href: "/contact", labelKey: "contact" },
];

interface PublicHeaderProps {
  variant?: "dark" | "light";
  className?: string;
}

/**
 * Public site header with logo, nav links, language/theme bar, sign in/up buttons.
 * Responsive: hamburger menu on mobile.
 *
 * `variant="dark"` is used on the landing hero (transparent over dark bg).
 * `variant="light"` is used on inner public pages (light card background).
 */
export function PublicHeader({
  variant = "light",
  className,
}: PublicHeaderProps) {
  const t = useTranslations("Public.nav");
  const [open, setOpen] = React.useState(false);
  const isDark = variant === "dark";

  const { isSignedIn } = useUser();
  const { user } = useUserStore();

  const dashboardLink = user ? getUserDashboardRoadByRole(user.role) : "";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-md",
        isDark
          ? "border-white/10 bg-secondary-900/70"
          : "border-border bg-background/80",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center"
          aria-label="Danaël — Accueil"
        >
          <Logo variant={isDark ? "light" : "default"} />
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-1 lg:flex"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isDark
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t(link.labelKey as never)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageThemeBar variant={isDark ? "outline" : "ghost"} />
          {isSignedIn ? (
            <Button asChild variant="brand" size="sm">
              <Link href={dashboardLink}>{t("dashboard")}</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={
                  isDark
                    ? "hidden text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex"
                    : "hidden sm:inline-flex"
                }
              >
                <Link href="/sign-in">{t("signIn")}</Link>
              </Button>
              <Button
                asChild
                variant="brand"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <Link href="/sign-up">
                  {t("signUp")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-md lg:hidden",
              isDark
                ? "text-white hover:bg-white/10"
                : "text-foreground hover:bg-accent",
            )}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {open && (
        <div
          id="mobile-nav"
          className="border-t border-border bg-background px-4 py-4 lg:hidden"
        >
          <nav aria-label="Navigation mobile" className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {t(link.labelKey as never)}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/sign-in" onClick={() => setOpen(false)}>
                  {t("signIn")}
                </Link>
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link href="/sign-up" onClick={() => setOpen(false)}>
                  {t("signUp")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
