import { PageHeader } from "@/components/shared/page-header";
import { MembersList } from "@/components/schools/members-list";
import { getMySchoolAction } from "@/server/actions/schools";
import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { InviteMemberDialog } from "@/components/schools/invite-member-dialog";

/**
 * §5.3 — School admin: list students enrolled in the school.
 *
 * Note: students can be invited but they typically join via a class invite
 * code, so this page is mostly read-only.
 */
export default async function StudentsPage() {
  const t = await getTranslations("Schools");
  const tNav = await getTranslations("Navigation");

  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  if (!school) {
    return (
      <>
        <PageHeader
          title={tNav("students")}
          description={t("noSchoolHint")}
          icon={<Users className="size-6" />}
        />
      </>
    );
  }

  return (
    <>
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
    </>
  );
}
