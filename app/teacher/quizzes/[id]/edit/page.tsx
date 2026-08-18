import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentDbUser } from "@/lib/clerk";
import { getQuizAction, updateQuizAction } from "@/server/actions/quizzes";
import { listSubjectsAction } from "@/server/actions/subjects";
import { QuizForm } from "@/components/quiz/quiz-form";
import type { UserRole } from "@/types";
import type {
  CreateQuizInput,
  QuizQuestionInput,
} from "@/server/validators/quizzes";

/**
 * §5.6 — Edit an existing quiz (teacher only, must be the creator).
 */
export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;

  const tQuiz = await getTranslations("Quizzes");
  void tQuiz;

  const quizRes = await getQuizAction(id);
  if (!quizRes.success) {
    if (quizRes.error.code === "NOT_FOUND") notFound();
    redirect("/quizzes");
  }
  const quiz = quizRes.data;

  // Only the creator (or platform_admin) can edit.
  if (quiz.createdBy !== user.id && role !== "platform_admin") {
    redirect("/quizzes");
  }

  // Cannot edit a published quiz — must unpublish first.
  if (quiz.isPublished) {
    redirect(`/quizzes/${quiz.id}`);
  }

  const subjectsRes = await listSubjectsAction();
  const subjects = subjectsRes.success ? subjectsRes.data : [];

  // Adapt quiz shape for the form.
  const initialQuiz = {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    subjectId: quiz.subjectId,
    skillId: quiz.skillId,
    level: quiz.level,
    series: quiz.series,
    type: quiz.type,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingScore: quiz.passingScore,
    isPublished: quiz.isPublished,
  };
  const initialQuestions: QuizQuestionInput[] = quiz.questions.map((q) => ({
    type: q.type,
    label: q.label,
    points: q.points,
    explanation: q.explanation ?? undefined,
    difficulty: q.difficulty ?? "medium",
    position: q.position,
    options: q.options.map((opt) => ({
      label: opt.label,
      isCorrect: opt.isCorrect,
      position: opt.position,
    })),
  }));

  async function submitAction(payload: CreateQuizInput & { id?: string }) {
    "use server";
    if (!payload.id) {
      return {
        success: false as const,
        error: {
          code: "VALIDATION_ERROR" as const,
          message: "Quiz id is required for update",
        },
      };
    }
    const result = await updateQuizAction({
      id: payload.id,
      title: payload.title,
      description: payload.description,
      subjectId: payload.subjectId,
      skillId: payload.skillId,
      level: payload.level,
      series: payload.series,
      type: payload.type,
      timeLimitMinutes: payload.timeLimitMinutes,
      passingScore: payload.passingScore,
      isPublished: payload.isPublished,
      questions: payload.questions,
    });
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
    <>
      <QuizForm
        mode="edit"
        initialQuiz={initialQuiz}
        initialQuestions={initialQuestions}
        subjects={subjects}
        submitAction={submitAction}
      />
    </>
  );
}
