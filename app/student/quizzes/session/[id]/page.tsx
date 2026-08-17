import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentDbUser } from "@/lib/clerk";
import { getQuizAction, getSessionAction } from "@/server/actions/quizzes";
import { QuizSessionView } from "@/components/quiz/quiz-session-view";
import type { UserRole } from "@/types";

/**
 * §5.6 — Quiz taking page.
 *
 * Loads the quiz + session server-side (auth + RBAC verified by the actions)
 * then hands off to the client <QuizSessionView /> for the interactive UI
 * (timer, navigation, answer submission).
 */
export default async function QuizSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = await params;
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  if (role !== "student" && role !== "tutor" && role !== "teacher") {
    redirect("/dashboard");
  }

  const tQuiz = await getTranslations("Quizzes");
  void tQuiz;

  const sessionRes = await getSessionAction(sessionId);
  if (!sessionRes.success) {
    if (sessionRes.error.code === "NOT_FOUND") notFound();
    redirect("/quizzes");
  }
  const session = sessionRes.data;

  // Only the session owner can take it.
  if (session.user.id !== user.id) {
    redirect("/quizzes");
  }

  // If the session is already completed, redirect to results.
  if (session.status !== "in_progress") {
    redirect(`/quizzes/session/${sessionId}/results`);
  }

  const quizRes = await getQuizAction(session.quiz.id);
  if (!quizRes.success) {
    redirect("/quizzes");
  }
  const quiz = quizRes.data;

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6">
        <QuizSessionView quiz={quiz} session={session} />
      </div>
    </>
  );
}
