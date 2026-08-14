import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StudentsExplorer } from "@/components/users/students-explorer";
import { getMySchoolAction } from "@/server/actions/schools";
import { listStudentsAction } from "@/server/actions/users";

/**
 * §5.3 — School admin: "Find a student" page.
 *
 * Same shell as /teachers/find but for inviting students.
 * Stats on cards highlight "strong points" to encourage invitations.
 */
export default async function FindStudentsPage() {
  const tUsers = await getTranslations("Users");

  // Load the school the admin is acting on behalf of.
  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  if (!school) {
    return (
      <DashboardShell>
        <PageHeader
          title={tUsers("findStudents")}
          description={tUsers("findStudentsSubtitle")}
          icon={<Search className="size-6" />}
        />
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Aucun établissement à administrer pour le moment. Créez ou rejoignez
          une école pour pouvoir inviter des élèves.
        </div>
      </DashboardShell>
    );
  }

  // First page of students — server-side.
  const studentsRes = await listStudentsAction({ page: 1, pageSize: 12 });
  const students = studentsRes.success ? studentsRes.data.items : [];
  const total = studentsRes.success ? studentsRes.data.total : 0;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={tUsers("findStudents")}
          description={tUsers("findStudentsSubtitle")}
          icon={<Search className="size-6" />}
        />
        <StudentsExplorer
          schoolId={school.id}
          initialItems={students}
          initialTotal={total}
        />
      </div>
    </DashboardShell>
  );
}
