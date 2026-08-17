import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { ReactNode } from "react";

/**
 * Admin layout — wraps all /admin/* routes.
 *
 * Responsibilities:
 *  1. Fetch the current DB user server-side.
 *  2. Enforce role-based access: only platform_admin, content_moderator,
 *     and support can access /admin/* routes. The middleware also enforces
 *     this, but this is the page-level safety net.
 *  3. Render <DashboardShell> with the hydrated user so all child pages
 *     can read the user from the Zustand store.
 *
 * Pages under /admin/* should NOT render <DashboardShell> themselves —
 * they just render their content as children of this layout.
 */
const ADMIN_ROLES = ["platform_admin", "content_moderator", "support"];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentDbUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.onboardingStatus !== "completed") {
    redirect("/onboarding/role");
  }

  // RBAC: only admin roles can access /admin/*
  if (!ADMIN_ROLES.includes(user.role)) {
    // Redirect to the user's own dashboard.
    const { getUserDashboardRoadByRole } = await import("@/lib/utils");
    redirect(getUserDashboardRoadByRole(user.role as never));
  }

  const userSession = toUserSessionData(user);

  return <DashboardShell user={userSession}>{children}</DashboardShell>;
}
