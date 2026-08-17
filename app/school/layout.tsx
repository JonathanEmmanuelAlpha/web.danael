import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getMySchoolAction } from "@/server/actions/schools";
import { listClassesAction } from "@/server/actions/classes";
import type { SchoolContextData, ClassContextData } from "@/stores/school-store";
import type { ReactNode } from "react";

/**
 * School admin layout — wraps all /school/* routes.
 *
 * Enforces role-based access: only "school_admin" role can access /school/*.
 * Also hydrates the school + classes context for the dashboard chrome.
 */
export default async function SchoolLayout({
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

  if (user.role !== "school_admin") {
    const { getUserDashboardRoadByRole } = await import("@/lib/utils");
    redirect(getUserDashboardRoadByRole(user.role as never));
  }

  const userSession = toUserSessionData(user);

  // Hydrate school + classes context.
  let school: SchoolContextData | null = null;
  let classes: ClassContextData[] | undefined;

  try {
    const schoolRes = await getMySchoolAction();
    if (schoolRes.success && schoolRes.data) {
      school = {
        id: schoolRes.data.id,
        name: schoolRes.data.name,
        slug: schoolRes.data.slug,
        type: schoolRes.data.type ?? null,
        city: schoolRes.data.city ?? null,
        region: schoolRes.data.region ?? null,
        logoUrl: schoolRes.data.logoUrl ?? null,
        isVerified: schoolRes.data.isVerified,
        contactEmail: schoolRes.data.contactEmail ?? null,
        contactPhone: schoolRes.data.contactPhone ?? null,
        joinCode: schoolRes.data.joinCode ?? null,
      } as SchoolContextData;

      const clsRes = await listClassesAction({
        schoolId: schoolRes.data.id,
        page: 1,
        pageSize: 100,
      });
      if (clsRes.success) {
        classes = clsRes.data.items.map((c) => ({
          id: c.id,
          schoolId: c.schoolId,
          name: c.name,
          level: c.level ?? null,
          series: c.series ?? null,
          academicYear: c.academicYear ?? null,
          inviteCode: c.inviteCode ?? null,
          headTeacherId: c.headTeacherId ?? null,
        })) as ClassContextData[];
      }
    }
  } catch {
    // School context is optional; ignore errors.
  }

  return (
    <DashboardShell user={userSession} school={school} classes={classes}>
      {children}
    </DashboardShell>
  );
}
