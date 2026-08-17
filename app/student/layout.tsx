import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { ReactNode } from "react";

/**
 * Student layout — wraps all /student/* routes.
 *
 * Enforces role-based access: only "student" role can access /student/*.
 * Renders <DashboardShell> with the hydrated user.
 */
export default async function StudentLayout({
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

  if (user.role !== "student") {
    const { getUserDashboardRoadByRole } = await import("@/lib/utils");
    redirect(getUserDashboardRoadByRole(user.role as never));
  }

  const userSession = toUserSessionData(user);

  return <DashboardShell user={userSession}>{children}</DashboardShell>;
}
