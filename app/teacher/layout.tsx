import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { ReactNode } from "react";

/**
 * Teacher layout — wraps all /teacher/* routes.
 *
 * Enforces role-based access: only "teacher" role can access /teacher/*.
 */
export default async function TeacherLayout({
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

  if (user.role !== "teacher") {
    const { getUserDashboardRoadByRole } = await import("@/lib/utils");
    redirect(getUserDashboardRoadByRole(user.role as never));
  }

  const userSession = toUserSessionData(user);

  return <DashboardShell user={userSession}>{children}</DashboardShell>;
}
