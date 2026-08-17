import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { SchoolContextData, ClassContextData } from "@/stores/school-store";
import type {
  NotificationItem,
  InvitationItem,
  JoinRequestItem,
} from "@/stores/notifications-store";
import type { User } from "@/server/db/schema/users";
import type { ReactNode } from "react";

export interface DashboardShellServerProps {
  children: ReactNode;
  /** Pre-fetched DB user (skip internal fetch). Can be null — the component
      will redirect to /sign-in in that case. */
  user?: User | null;
  /** School context to hydrate (optional). */
  school?: SchoolContextData | null;
  classes?: ClassContextData[];
  notifications?: NotificationItem[];
  invitations?: InvitationItem[];
  myJoinRequests?: JoinRequestItem[];
  receivedJoinRequests?: JoinRequestItem[];
  /** Whether to auto-fetch school + classes context. */
  withSchoolContext?: boolean;
}

/**
 * Server-component wrapper around <DashboardShell>.
 *
 * This is the canonical way to render the dashboard chrome from a shared
 * page (one that doesn't belong to a single role's layout — e.g. /classes,
 * /messages, /settings). It:
 *   1. Fetches the current DB user server-side (or uses a pre-fetched one).
 *   2. If the user is missing or onboarding isn't complete, redirects.
 *   3. Renders <DashboardShell user={...} /> which hydrates the Zustand
 *      user store on mount.
 *
 * Pages under role-specific layouts (/admin/*, /student/*, etc.) should
 * NOT use this — their layout already provides <DashboardShell>.
 */
export async function DashboardShellServer({
  children,
  user: preFetchedUser,
  school,
  classes,
  notifications,
  invitations,
  myJoinRequests,
  receivedJoinRequests,
  withSchoolContext = false,
}: DashboardShellServerProps) {
  const user = preFetchedUser ?? (await getCurrentDbUser());

  if (!user) {
    redirect("/sign-in");
  }

  if (user.onboardingStatus !== "completed") {
    redirect("/onboarding/role");
  }

  const userSession = toUserSessionData(user);

  let resolvedSchool = school ?? null;
  let resolvedClasses = classes;

  if (withSchoolContext && !resolvedSchool) {
    try {
      const { getMySchoolAction } = await import("@/server/actions/schools");
      const { listClassesAction } = await import("@/server/actions/classes");
      const schoolRes = await getMySchoolAction();
      if (schoolRes.success && schoolRes.data) {
        resolvedSchool = {
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
          resolvedClasses = clsRes.data.items.map((c) => ({
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
  }

  return (
    <DashboardShell
      user={userSession}
      school={resolvedSchool}
      classes={resolvedClasses}
      notifications={notifications}
      invitations={invitations}
      myJoinRequests={myJoinRequests}
      receivedJoinRequests={receivedJoinRequests}
    >
      {children}
    </DashboardShell>
  );
}
