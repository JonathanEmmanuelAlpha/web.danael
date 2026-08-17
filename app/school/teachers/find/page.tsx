import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { TeachersExplorer } from "@/components/users/teachers-explorer";
import { getMySchoolAction } from "@/server/actions/schools";
import {
  listSubjectsForFilterAction,
  listTeachersAction,
} from "@/server/actions/users";

/**
 * §5.3 — School admin: "Find a teacher" page.
 *
 * Server component that:
 *  1. Authenticates the user + ensures role = school_admin / platform_admin
 *  2. Loads the admin's school (for the invite target id)
 *  3. Loads the first page of teachers server-side (instant render)
 *  4. Loads the subject filter options
 *  5. Hands off to <TeachersExplorer> for infinite scroll
 */
export default async function FindTeachersPage() {
  const tUsers = await getTranslations("Users");

  // Load the school the admin is acting on behalf of.
  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  if (!school) {
    return (
      <>
        <PageHeader
          title={tUsers("findTeachers")}
          description={tUsers("findTeachersSubtitle")}
          icon={<Search className="size-6" />}
        />
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Aucun établissement à administrer pour le moment. Créez ou rejoignez
          une école pour pouvoir inviter des enseignants.
        </div>
      </>
    );
  }

  // First page of teachers + subject filter options — server-side.
  const [teachersRes, subjectsRes] = await Promise.all([
    listTeachersAction({ page: 1, pageSize: 12 }),
    listSubjectsForFilterAction(),
  ]);

  const teachers = teachersRes.success ? teachersRes.data.items : [];
  const total = teachersRes.success ? teachersRes.data.total : 0;
  const subjects = subjectsRes.success ? subjectsRes.data : [];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={tUsers("findTeachers")}
          description={tUsers("findTeachersSubtitle")}
          icon={<Search className="size-6" />}
        />
        <TeachersExplorer
          schoolId={school.id}
          initialItems={teachers}
          initialTotal={total}
          subjects={subjects}
        />
      </div>
    </>
  );
}
