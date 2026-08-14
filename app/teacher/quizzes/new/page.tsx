import { getTranslations } from "next-intl/server";
import { listSubjectsAction } from "@/server/actions/subjects";
import { createQuizAction } from "@/server/actions/quizzes";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuizForm } from "@/components/quiz/quiz-form";

/**
 * §5.6 — Create a new quiz (teacher only).
 *
 * Server Component — fetches the subjects list server-side and passes it to
 * the client <QuizForm /> which calls the inline server action on submit.
 */
export default async function NewQuizPage() {
  const subjectsRes = await listSubjectsAction();
  const subjects = subjectsRes.success ? subjectsRes.data : [];

  await getTranslations("Quizzes");

  async function submitAction(payload: Parameters<typeof createQuizAction>[0]) {
    "use server";
    const result = await createQuizAction(payload);
    if (result.success) {
      return { success: true as const, data: { id: result.data.id } };
    }
    return {
      success: false as const,
      error: {
        code: result.error.code,
        message: result.error.message,
      },
    };
  }

  return (
    <DashboardShell>
      <QuizForm mode="create" subjects={subjects} submitAction={submitAction} />
    </DashboardShell>
  );
}
