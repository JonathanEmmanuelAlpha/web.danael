import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpCircle } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StudentQuizzesList } from "@/components/quiz/student-quizzes-list";
import type { UserRole } from "@/types";

/**
 * §5.6 — Student quizzes list page.
 *
 * Shows published quizzes available to the student.
 */
export default async function StudentQuizzesPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  // Students (and tutors who act as learners) can take quizzes.
  if (
    role !== "student" &&
    role !== "tutor" &&
    role !== "teacher"
  ) {
    redirect("/dashboard");
  }

  const tNav = await getTranslations("Navigation");
  const tQuiz = await getTranslations("Quizzes");
  void tNav;
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <div className="space-y-6">
        <PageHeader
          title={tQuiz("availableQuizzes")}
          description={tQuiz("availableQuizzesHint")}
          icon={<HelpCircle className="size-6" />}
        />
        <StudentQuizzesList studentId={user.id} />
      </div>
    </DashboardShell>
  );
}
