"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { QuestionTypes } from "./question-types";
import { useQuizSessionStore, formatTime } from "@/stores/quiz-session-store";
import {
  submitAnswerAction,
  completeSessionAction,
} from "@/server/actions/quizzes";
import type {
  QuizWithDetails,
  QuizSessionWithRelations,
} from "@/server/services/quizzes";
import type { QuizAnswerDraft } from "@/stores/quiz-session-store";

interface QuizSessionViewProps {
  quiz: QuizWithDetails;
  session: QuizSessionWithRelations;
}

/**
 * §5.6 — Quiz taking interface.
 *
 * Features:
 *  - One question at a time (currentQuestionIndex in store).
 *  - Progress bar (answered / total).
 *  - Countdown timer (auto-completes when reaching 0).
 *  - Save answer per question (auto-graded for MCQ / true-false / multiple).
 *  - Navigation: previous / next / jump-to.
 *  - Finish button with confirmation dialog.
 */
export function QuizSessionView({ quiz, session }: QuizSessionViewProps) {
  const t = useTranslations("Quizzes");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const store = useQuizSessionStore();
  const init = store.init;
  const currentIndex = store.currentIndex;
  const answers = store.answers;
  const timeRemaining = store.timeRemaining;
  const tick = store.tick;
  const goTo = store.goTo;
  const next = store.next;
  const previous = store.previous;
  const setAnswer = store.setAnswer;
  const setStoreFinishing = store.setFinishing;

  const [pendingSave, setPendingSave] = useState(false);
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
  const [finishing, setLocalFinishing] = useState(false);
  const initializedRef = useRef(false);

  // Initialize the store once.
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const timeLimitSeconds =
      quiz.timeLimitMinutes && quiz.timeLimitMinutes > 0
        ? quiz.timeLimitMinutes * 60
        : null;
    init({
      sessionId: session.id,
      quizId: quiz.id,
      totalQuestions: quiz.questions.length,
      timeLimitSeconds,
    });
  }, [init, quiz, session.id]);

  // Tick the timer every second.
  useEffect(() => {
    if (timeRemaining === null) return;
    if (timeRemaining <= 0) return;
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining, tick]);

  // Auto-complete when the timer reaches 0.
  const finishRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (timeRemaining === null) return;
    if (timeRemaining !== 0) return;
    if (finishRef.current) void finishRef.current();
  }, [timeRemaining]);

  const currentQuestion = quiz.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progress =
    quiz.questions.length > 0
      ? (answeredCount / quiz.questions.length) * 100
      : 0;

  // Save the answer for the current question.
  async function handleSaveAnswer(answer: QuizAnswerDraft | undefined) {
    if (!currentQuestion || !answer) return;
    setPendingSave(true);
    const result = await submitAnswerAction({
      sessionId: session.id,
      questionId: currentQuestion.id,
      answerText:
        answer.questionType === "short_answer" ||
        answer.questionType === "essay"
          ? answer.answerText
          : undefined,
      selectedOptionId:
        answer.questionType === "single_choice" ||
        answer.questionType === "true_false"
          ? answer.selectedOptionId
          : undefined,
      selectedOptionIds:
        answer.questionType === "multiple_choice"
          ? answer.selectedOptionIds
          : undefined,
      timeSpent: 0,
    });
    setPendingSave(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("error"));
      return;
    }
    setSavedQuestions((prev) => {
      const next = new Set(prev);
      next.add(currentQuestion.id);
      return next;
    });
    if (result.data.isCorrect === null) {
      // Manual grading required — silent.
    } else if (result.data.isCorrect) {
      // Light feedback only — we don't want to reveal all answers mid-quiz.
    }
  }

  function handleSelectAnswer(answer: QuizAnswerDraft) {
    if (!currentQuestion) return;
    setAnswer(currentQuestion.id, answer);
    void handleSaveAnswer(answer);
  }

  async function handleNext() {
    if (currentIndex < quiz.questions.length - 1) {
      next();
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      previous();
    }
  }

  async function handleFinish(auto = false) {
    setLocalFinishing(true);
    setStoreFinishing(true);
    const result = await completeSessionAction({
      id: session.id,
      status: "completed",
    });
    setLocalFinishing(false);
    setStoreFinishing(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("error"));
      return;
    }
    toast.success(auto ? t("sessionExpired") : t("sessionCompleted"));
    router.push(`/quizzes/session/${session.id}/results`);
    router.refresh();
  }

  // Wire the latest handleFinish into the ref for the timer effect.
  useEffect(() => {
    finishRef.current = () => handleFinish(true);
    return () => {
      finishRef.current = null;
    };
  });

  if (!currentQuestion) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="size-10 text-warning" />
        <p className="text-lg font-semibold">{t("noQuestions")}</p>
        <p className="text-sm text-muted-foreground">{t("noQuestionsHint")}</p>
      </div>
    );
  }

  const isLast = currentIndex === quiz.questions.length - 1;

  return (
    <div className="space-y-6">
      {/* Top bar: timer + progress */}
      <Card className="gap-0 overflow-hidden">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold text-foreground">
              {quiz.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("questionOf", {
                current: currentIndex + 1,
                total: quiz.questions.length,
              })}
            </p>
          </div>
          {timeRemaining !== null ? (
            <div className="flex items-center gap-2">
              <Badge
                variant={timeRemaining <= 30 ? "destructive" : "info"}
                size="lg"
              >
                <Clock className="size-3.5" />
                {formatTime(timeRemaining)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("timeRemaining")}
              </span>
            </div>
          ) : null}
        </div>
        <div className="border-t border-border px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("progress")}</span>
            <span>
              {t("answeredCount", {
                answered: answeredCount,
                total: quiz.questions.length,
              })}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </Card>

      {/* Question navigation pills */}
      <QuestionNav
        total={quiz.questions.length}
        current={currentIndex}
        answeredByIndex={quiz.questions.map((q) => Boolean(answers[q.id]))}
        onJump={(i) => goTo(i)}
      />

      {/* Current question */}
      <Card className="gap-0 overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-base font-semibold text-foreground">
              {currentQuestion.label}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary" size="sm">
                {t("pointsAwarded", { points: currentQuestion.points })}
              </Badge>
            </div>
          </div>
        </div>
        <div className="p-5">
          <QuestionTypes
            question={currentQuestion}
            value={answers[currentQuestion.id]}
            onChange={handleSelectAnswer}
            disabled={false}
          />
        </div>
      </Card>

      {/* Navigation footer */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={handlePrevious}
          disabled={currentIndex === 0 || pendingSave}
        >
          <ArrowLeft className="size-4" />
          {t("previous")}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSaveAnswer(answers[currentQuestion.id])}
            disabled={
              pendingSave ||
              !answers[currentQuestion.id] ||
              savedQuestions.has(currentQuestion.id)
            }
          >
            {pendingSave ? (
              <Loader2 className="size-4 animate-spin" />
            ) : savedQuestions.has(currentQuestion.id) ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <Save className="size-4" />
            )}
            {savedQuestions.has(currentQuestion.id)
              ? t("answerSaved")
              : t("submitAnswer")}
          </Button>

          {!isLast ? (
            <Button
              type="button"
              variant="brand"
              onClick={handleNext}
              disabled={pendingSave}
            >
              {t("next")}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="brand" disabled={finishing}>
                  {finishing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Flag className="size-4" />
                  )}
                  {t("finish")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("finish")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("finishConfirm")}{" "}
                    {answeredCount < quiz.questions.length
                      ? `(${t("answeredCount", {
                          answered: answeredCount,
                          total: quiz.questions.length,
                        })})`
                      : ""}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={finishing}>
                    {tCommon("back")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      void handleFinish(false);
                    }}
                    disabled={finishing}
                  >
                    {finishing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Flag className="size-4" />
                    )}
                    {t("finish")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

/* -- Question nav pills ------------------------------------- */

function QuestionNav({
  total,
  current,
  answeredByIndex,
  onJump,
}: {
  total: number;
  current: number;
  answeredByIndex: boolean[];
  onJump: (index: number) => void;
}) {
  const t = useTranslations("Quizzes");
  const pills = useMemo(
    () => Array.from({ length: total }, (_, i) => i),
    [total],
  );

  return (
    <Card className="gap-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          {t("questions")}:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {pills.map((i) => {
            const isCurrent = i === current;
            const isAnswered = answeredByIndex[i] === true;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onJump(i)}
                aria-label={`${t("question")} ${i + 1}`}
                aria-current={isCurrent ? "true" : undefined}
                className={`flex size-9 items-center justify-center rounded-lg border text-sm font-medium transition ${
                  isCurrent
                    ? "border-primary-500 bg-primary-500 text-white"
                    : isAnswered
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border bg-background text-muted-foreground hover:border-primary-500/40 hover:bg-primary-500/5"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
