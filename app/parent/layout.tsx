import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { ReactNode } from "react";

/**
 * Parent layout — wraps all /parent/* routes.
 *
 * Enforces role-based access: only "parent" role can access /parent/*.
 */
export default async function ParentLayout({
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

  if (user.role !== "parent") {
    const { getUserDashboardRoadByRole } = await import("@/lib/utils");
    redirect(getUserDashboardRoadByRole(user.role as never));
  }

  const userSession = toUserSessionData(user);

  return <DashboardShell user={userSession}>{children}</DashboardShell>;
}
