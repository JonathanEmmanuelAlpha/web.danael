import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { MembersList } from "@/components/schools/members-list";
import { getMySchoolAction } from "@/server/actions/schools";
import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";
import { InviteMemberDialog } from "@/components/schools/invite-member-dialog";

/**
 * §5.3 — School admin: list students enrolled in the school.
 *
 * Note: students can be invited but they typically join via a class invite
 * code, so this page is mostly read-only.
 */
export default async function StudentsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const t = await getTranslations("Schools");
  const tNav = await getTranslations("Navigation");

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
          title={tNav("students")}
          description={t("noSchoolHint")}
          icon={<Users className="size-6" />}
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
          title={tNav("students")}
          description={t("inviteStudent")}
          icon={<Users className="size-6" />}
          actions={
            <div className="flex justify-end">
              <InviteMemberDialog
                targetId={school!.id}
                targetType="school"
                defaultRole={"student"}
                allowedRoles={["student"]}
                buttonLabel={t("inviteStudent") ?? t("inviteMember")}
              />
            </div>
          }
        />
        <MembersList
          schoolId={school.id}
          filterRole="student"
          inviteRole="student"
          inviteLabel={t("inviteStudent")}
          emptyTitle={t("noMembers")}
          emptyHint={t("noMembersHint")}
        />
      </div>
    </DashboardShell>
  );
}
