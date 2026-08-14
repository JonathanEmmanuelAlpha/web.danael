import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpCircle } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import {
  TeacherQuizzesList,
  CreateQuizButton,
} from "@/components/quiz/teacher-quizzes-list";
import type { UserRole } from "@/types";

/**
 * §5.6 — Teacher quizzes list page.
 *
 * Only `teacher`, `school_admin`, and `platform_admin` can access this.
 * The (teacher) route group is a Server Component wrapper — the list itself
 * is a Client Component fetching via server actions.
 */
export default async function TeacherQuizzesPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  if (
    role !== "teacher" &&
    role !== "school_admin" &&
    role !== "platform_admin"
  ) {
    redirect("/dashboard");
  }

  const tNav = await getTranslations("Navigation");
  const tQuiz = await getTranslations("Quizzes");
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
          title={tQuiz("myQuizzes")}
          description={tQuiz("createDescription")}
          icon={<HelpCircle className="size-6" />}
          actions={<CreateQuizButton />}
        />
        <TeacherQuizzesList teacherId={user.id} />
      </div>
    </DashboardShell>
  );
}
