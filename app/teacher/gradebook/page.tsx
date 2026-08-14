import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherGradebookView } from "@/components/assignments/teacher-gradebook-view";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * §5.5 — Gradebook page (teacher).
 *
 * Renders a matrix of students × assignments with their scores.
 */
export default async function GradebookPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const t = await getTranslations("Assignments");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={t("gradebook")}
          description={t("gradebookDescription")}
          icon={<BookOpen className="size-6" />}
        />
        <TeacherGradebookView teacherId={user.id} />
      </div>
    </DashboardShell>
  );
}
