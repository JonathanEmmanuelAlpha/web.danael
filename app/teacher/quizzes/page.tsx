import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpCircle } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
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

  const tQuiz = await getTranslations("Quizzes");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={tQuiz("myQuizzes")}
          description={tQuiz("createDescription")}
          icon={<HelpCircle className="size-6" />}
          actions={<CreateQuizButton />}
        />
        <TeacherQuizzesList teacherId={user.id} />
      </div>
    </>
  );
}
