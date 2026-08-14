import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentDbUser } from "@/lib/clerk";
import { listSubjectsAction } from "@/server/actions/subjects";
import { createQuizAction } from "@/server/actions/quizzes";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QuizForm } from "@/components/quiz/quiz-form";
import type { UserRole } from "@/types";

/**
 * §5.6 — Create a new quiz (teacher only).
 *
 * Server Component — fetches the subjects list server-side and passes it to
 * the client <QuizForm /> which calls the inline server action on submit.
 */
export default async function NewQuizPage() {
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

  const subjectsRes = await listSubjectsAction();
  const subjects = subjectsRes.success ? subjectsRes.data : [];

  await getTranslations("Quizzes");
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  async function submitAction(
    payload: Parameters<typeof createQuizAction>[0],
  ) {
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
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <QuizForm
        mode="create"
        subjects={subjects}
        submitAction={submitAction}
      />
    </DashboardShell>
  );
}
