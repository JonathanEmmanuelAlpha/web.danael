import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { ReactNode } from "react";

/**
 * Tutor layout — wraps all /tutor/* routes.
 *
 * Enforces role-based access: only "tutor" role can access /tutor/*.
 */
export default async function TutorLayout({
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

  if (user.role !== "tutor") {
    const { getUserDashboardRoadByRole } = await import("@/lib/utils");
    redirect(getUserDashboardRoadByRole(user.role as never));
  }

  const userSession = toUserSessionData(user);

  return <DashboardShell user={userSession}>{children}</DashboardShell>;
}
