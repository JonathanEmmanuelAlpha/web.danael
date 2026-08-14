import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StudentCompetitionsList } from "@/components/gamification/student-competitions-list";
import type { UserRole } from "@/types";

/**
 * §5.7 — Student competitions list page.
 *
 * Tabs: "Active competitions" + "My competitions" (joined).
 */
export default async function StudentCompetitionsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  if (
    role !== "student" &&
    role !== "tutor" &&
    role !== "teacher"
  ) {
    redirect("/dashboard");
  }

  const tComp = await getTranslations("Competitions");
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <div className="space-y-6">
        <PageHeader
          title={tComp("title")}
          description={tComp("studentDescription")}
          icon={<Trophy className="size-6" />}
        />
        <StudentCompetitionsList userId={user.id} />
      </div>
    </DashboardShell>
  );
}
