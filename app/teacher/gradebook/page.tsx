import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherGradebookView } from "@/components/assignments/teacher-gradebook-view";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

/**
 * §5.5 — Gradebook page (teacher).
 *
 * Renders a matrix of students × assignments with their scores.
 */
export default async function GradebookPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  if (user.role !== "teacher" && user.role !== "school_admin" && user.role !== "platform_admin") {
    redirect("/dashboard");
  }

  const t = await getTranslations("Assignments");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
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
