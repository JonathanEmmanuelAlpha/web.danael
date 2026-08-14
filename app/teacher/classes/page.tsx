import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { ClassesList } from "@/components/schools/classes-list";
import { CreateClassDialog } from "@/components/schools/create-class-dialog";
import { JoinClassDialog } from "@/components/schools/join-class-dialog";
import { getMySchoolAction } from "@/server/actions/schools";
import { School } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

/**
 * §5.3 — Classes list page (shared by school_admin + teacher + student).
 *
 * - school_admin → all classes in their school + Create Class button
 * - teacher → classes they teach + Join Class button (no Create — teachers
 *   can no longer create classes; only school_admin can).
 * - student → classes they're enrolled in + Join Class button
 */
export default async function ClassesPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const tNav = await getTranslations("Navigation");
  const tCls = await getTranslations("Classes");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  // school_admin path
  if (role === "school_admin") {
    const schoolRes = await getMySchoolAction();
    const school = schoolRes.success ? schoolRes.data : null;

    if (!school) {
      return (
        <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
          <PageHeader
            title={tNav("classes")}
            description={tCls("createClassDescription")}
            icon={<School className="size-6" />}
          />
        </DashboardShell>
      );
    }

    return (
      <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
        <div className="space-y-6">
          <PageHeader
            title={tNav("classes")}
            description={tCls("createClassDescription")}
            icon={<School className="size-6" />}
            actions={
              <CreateClassDialog schoolId={school.id} />
            }
          />
          <ClassesList
            schoolId={school.id}
            showCreateButton={false}
            emptyTitle={tCls("noMembers")}
            emptyHint={tCls("noMembersHint")}
          />
        </div>
      </DashboardShell>
    );
  }

  // teacher path
  if (role === "teacher") {
    return (
      <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
        <div className="space-y-6">
          <PageHeader
            title={tNav("classes")}
            description={tCls("createClassDescription")}
            icon={<School className="size-6" />}
            actions={
              <div className="flex gap-2">
                <JoinClassDialog defaultRole="teacher" allowedRoles={["teacher"]} />
              </div>
            }
          />
          <ClassesList
            teacherId={user.id}
            emptyTitle={tCls("noMembers")}
            emptyHint={tCls("noMembersHint")}
          />
        </div>
      </DashboardShell>
    );
  }

  // student path (and any other role)
  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          title={tNav("classes")}
          description={tCls("joinClassDescription")}
          icon={<School className="size-6" />}
          actions={<JoinClassDialog defaultRole="student" allowedRoles={["student"]} />}
        />
        <ClassesList
          studentId={user.id}
          emptyTitle={tCls("noMembers")}
          emptyHint={tCls("noMembersHint")}
        />
      </div>
    </DashboardShell>
  );
}
