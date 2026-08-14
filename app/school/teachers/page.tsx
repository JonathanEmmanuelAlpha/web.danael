import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { MembersList } from "@/components/schools/members-list";
import { getMySchoolAction } from "@/server/actions/schools";
import { GraduationCap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { InviteMemberDialog } from "@/components/schools/invite-member-dialog";

/**
 * §5.3 — School admin: list + invite teachers.
 */
export default async function TeachersPage() {
  const t = await getTranslations("Schools");
  const tNav = await getTranslations("Navigation");

  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  if (!school) {
    return (
      <DashboardShell>
        <PageHeader
          title={tNav("teachers")}
          description={t("noSchoolHint")}
          icon={<GraduationCap className="size-6" />}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
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
