import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentDbUser } from "@/lib/clerk";
import {
  getSessionAction,
  getSessionResultsAction,
} from "@/server/actions/quizzes";
import { QuizResultsView } from "@/components/quiz/quiz-results-view";
import type { UserRole } from "@/types";

/**
 * §5.6 — Quiz session results page.
 *
 * Accessible by:
 *  - The session owner (student reviewing their own quiz).
 *  - The quiz creator (teacher reviewing a student's attempt).
 *  - platform_admin.
 *
 * The viewer role determines which "back" link is shown.
 */
export default async function QuizSessionResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = await params;
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;

  const tQuiz = await getTranslations("Quizzes");
  void tQuiz;

  const sessionRes = await getSessionAction(sessionId);
  if (!sessionRes.success) {
    if (sessionRes.error.code === "NOT_FOUND") notFound();
    redirect("/dashboard");
  }
  const session = sessionRes.data;

  const isOwner = session.user.id === user.id;
  const isCreator = session.quiz.createdBy === user.id;
  if (!isOwner && !isCreator && role !== "platform_admin") {
    redirect("/dashboard");
  }

  // If the session is still in progress, redirect to the taking page.
  if (session.status === "in_progress") {
    redirect(`/quizzes/session/${sessionId}`);
  }

  const resultsRes = await getSessionResultsAction(sessionId);
  if (!resultsRes.success) {
    if (resultsRes.error.code === "NOT_FOUND") notFound();
    redirect("/dashboard");
  }
  const results = resultsRes.data;

  const viewer: "student" | "teacher" = isOwner ? "student" : "teacher";

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <QuizResultsView results={results} viewer={viewer} />
      </div>
    </>
  );
}
