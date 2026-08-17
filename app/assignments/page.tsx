import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherAssignmentsList } from "@/components/assignments/teacher-assignments-list";
import { StudentAssignmentsList } from "@/components/assignments/student-assignments-list";
import { Plus, ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

/**
 * §5.5 — Assignments list page (shared by teachers and students).
 *
 * - teacher / school_admin / platform_admin: shows the teacher's assignments
 *   with summary stats + a "Create assignment" button.
 * - student (and any other role): shows the student's "to-do" assignments with
 *   submission status badges.
 *
 * Resolves to `/assignments` (single route group, no conflict with /(student)).
 */
export default async function AssignmentsPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const t = await getTranslations("Assignments");
  const role = user.role as UserRole;

  // Teacher view.
  if (
    role === "teacher" ||
    role === "school_admin" ||
    role === "platform_admin"
  ) {
    return (
      <>
        <div className="space-y-6">
          <PageHeader
            title={t("title")}
            description={t("noAssignmentsHint")}
            icon={<ClipboardList className="size-6" />}
            actions={
              <Link
                href="/assignments/new"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-to-br from-primary-500 to-primary-600 px-4 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_-8px_rgba(147,217,26,0.5)] hover:from-primary-600 hover:to-primary-700"
              >
                <Plus className="size-4" />
                {t("create")}
              </Link>
            }
          />
          <TeacherAssignmentsList />
        </div>
      </>
    );
  }

  // Student (and any other role) view.
  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("noAssignmentsStudentHint")}
          icon={<ClipboardList className="size-6" />}
        />
        <StudentAssignmentsList />
      </div>
    </>
  );
}
