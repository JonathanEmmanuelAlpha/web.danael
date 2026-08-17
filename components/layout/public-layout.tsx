import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public/header";
import { Footer } from "@/components/public/footer";
import { DashboardLinkButton } from "@/components/public/dashboard-link-button";
import { getTranslations } from "next-intl/server";

export interface PublicLayoutProps {
  children: ReactNode;
  className?: string;
  /** Header variant: "dark" for hero overlay, "light" for inner pages. */
  variant?: "dark" | "light";
}

/**
 * Layout for public pages (landing, pricing, testimonials…).
 * Sticky header + content + sticky footer (mt-auto).
 *
 * The header's "Dashboard" button is rendered server-side via
 * <DashboardLinkButton /> so it points to the correct role-based dashboard
 * even though the Zustand user store isn't hydrated on public pages.
 */
export async function PublicLayout({
  children,
  className,
  variant = "light",
}: PublicLayoutProps) {
  const t = await getTranslations("Public.nav");

  return (
    <div className={cn("flex min-h-screen flex-col bg-background", className)}>
      <PublicHeader
        variant={variant}
        dashboardSlot={
          <DashboardLinkButton label={t("dashboard")} />
        }
      />
      <main className="flex-1">{children}</main>
      <Footer variant="default" />
    </div>
  );
}
