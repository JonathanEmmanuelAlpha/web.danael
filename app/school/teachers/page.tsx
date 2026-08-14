import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { MembersList } from "@/components/schools/members-list";
import { getMySchoolAction } from "@/server/actions/schools";
import { GraduationCap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";
import { InviteMemberDialog } from "@/components/schools/invite-member-dialog";

/**
 * §5.3 — School admin: list + invite teachers.
 */
export default async function TeachersPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const t = await getTranslations("Schools");
  const tNav = await getTranslations("Navigation");

  // Only school_admins / platform_admins can view this page.
  const role = user.role as UserRole;
  if (role !== "school_admin" && role !== "platform_admin") {
    redirect("/dashboard");
  }

  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  if (!school) {
    return (
      <DashboardShell
        role={role}
        userName={userName}
        userImage={user.avatarUrl ?? undefined}
      >
        <PageHeader
          title={tNav("teachers")}
          description={t("noSchoolHint")}
          icon={<GraduationCap className="size-6" />}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <div className="space-y-6">
        <PageHeader
          title={tNav("teachers")}
          description={t("inviteTeacher")}
          icon={<GraduationCap className="size-6" />}
          actions={
            <div className="flex justify-end">
              <InviteMemberDialog
                targetId={school!.id}
                targetType="school"
                defaultRole={"teacher"}
                allowedRoles={["teacher"]}
                buttonLabel={t("inviteTeacher") ?? t("inviteMember")}
              />
            </div>
          }
        />
        <MembersList
          schoolId={school.id}
          filterRole="teacher"
          inviteRole="teacher"
          inviteLabel={t("inviteTeacher")}
          emptyTitle={t("noMembers")}
          emptyHint={t("noMembersHint")}
        />
      </div>
    </DashboardShell>
  );
}
