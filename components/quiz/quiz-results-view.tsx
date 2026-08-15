"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  MinusCircle,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QuizTypeBadge } from "./quiz-type-badge";
import type { QuizSessionResults } from "@/server/services/quizzes";
import type { Level } from "@/types";
import { formatTime } from "@/stores/quiz-session-store";

interface QuizResultsViewProps {
  results: QuizSessionResults;
  /**
   * "student" — the student viewing their own results.
   * "teacher" — the teacher reviewing a student's session.
   */
  viewer: "student" | "teacher";
}

/**
 * §5.6 — Quiz results screen.
 *
 * Shows:
 *  - Big score banner (passed/failed, percentage, score / max).
 *  - Quiz metadata (type, level, subject, time spent).
 *  - Per-question breakdown with the student's answer, the correct answer,
 *    the explanation, and points awarded.
 */
export function QuizResultsView({ results, viewer }: QuizResultsViewProps) {
  const t = useTranslations("Quizzes");
  const tCommon = useTranslations("Common");
  const tClasses = useTranslations("Classes");

  const { quiz, session, answers, totalScore, maxScore, percentage, passed } =
    results;

  const level = quiz.level as Level | null;
  const levelLabel = level ? tClasses(`levelLabels.${level}` as const) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={t("backToQuizzes")}
        >
          <Link href="/teacher-quizzes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("results")}
          </h1>
          <p className="text-sm text-muted-foreground">{quiz.title}</p>
        </div>
      </div>

      {/* Score banner */}
      <Card className="overflow-hidden">
        <div
          className={`flex flex-col items-center justify-center gap-3 px-6 py-10 text-center ${
            passed
              ? "bg-gradient-to-br from-success/10 to-success/5"
              : "bg-gradient-to-br from-destructive/10 to-destructive/5"
          }`}
        >
          <div
            className={`flex size-20 items-center justify-center rounded-full ${
              passed
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {passed ? (
              <Trophy className="size-10" />
            ) : (
              <Award className="size-10" />
            )}
          </div>
          <div>
            <p
              className={`font-display text-4xl font-bold ${
                passed ? "text-success" : "text-destructive"
              }`}
            >
              {percentage}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("scoreValue", { score: totalScore, max: maxScore })}
            </p>
          </div>
          <Badge variant={passed ? "success" : "destructive"} size="lg">
            {passed ? (
              <>
                <CheckCircle2 className="size-3.5" />
                {t("passed")}
              </>
            ) : (
              <>
                <XCircle className="size-3.5" />
                {t("failed")}
              </>
            )}
          </Badge>
        </div>

        {/* Quiz metadata */}
        <div className="grid grid-cols-2 gap-4 border-t border-border px-6 py-4 sm:grid-cols-4">
          <Meta label={t("type")}>
            <QuizTypeBadge type={quiz.type} />
          </Meta>
          <Meta label={t("level")}>
            <span className="text-sm font-medium text-foreground">
              {levelLabel ?? tCommon("none")}
            </span>
          </Meta>
          <Meta label={t("timeSpent")}>
            <span className="flex items-center gap-1 text-sm font-medium text-foreground">
              <Clock className="size-3.5 text-muted-foreground" />
              {formatTime(session.timeSpent)}
            </span>
          </Meta>
          <Meta label={t("passingScore")}>
            <span className="text-sm font-medium text-foreground">
              {quiz.passingScore}%
            </span>
          </Meta>
        </div>
      </Card>

      {/* Score breakdown */}
      <Card className="gap-0 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">
            {t("progress")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("answeredCount", {
              answered: answers.filter((a) => a.id).length,
              total: answers.length,
            })}
          </p>
          <Progress
            value={maxScore > 0 ? (totalScore / maxScore) * 100 : 0}
            className="mt-3 h-2"
          />
        </div>
        <div className="space-y-4 p-5">
          {answers.map((answer, idx) => (
            <QuestionResult
              key={answer.question.id}
              index={idx}
              answer={answer}
            />
          ))}
        </div>
      </Card>

      {/* Footer actions */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost">
          <Link href="/teacher-quizzes">{t("backToQuizzes")}</Link>
        </Button>
        {viewer === "teacher" ? (
          <Button asChild variant="brand">
            <Link href={`/quizzes/${quiz.id}`}>{t("backToQuiz")}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* -- Per-question result ------------------------------------ */

function QuestionResult({
  index,
  answer,
}: {
  index: number;
  answer: QuizSessionResults["answers"][number];
}) {
  const t = useTranslations("Quizzes");

  const isAuto =
    answer.question.type === "single_choice" ||
    answer.question.type === "true_false" ||
    answer.question.type === "multiple_choice";

  const status = !isAuto
    ? "pending"
    : answer.isCorrect === null
      ? "pending"
      : answer.isCorrect
        ? "correct"
        : "incorrect";

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("question")} {index + 1}
          </p>
          <p className="mt-1 font-medium text-foreground">
            {answer.question.label}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status === "correct" ? (
            <Badge variant="success" size="sm">
              <CheckCircle2 className="size-3" />
              {t("correct")}
            </Badge>
          ) : status === "incorrect" ? (
            <Badge variant="destructive" size="sm">
              <XCircle className="size-3" />
              {t("incorrect")}
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              <MinusCircle className="size-3" />
              {t("pendingGrading")}
            </Badge>
          )}
          <Badge variant="secondary" size="sm">
            {t("pointsAwarded", { points: answer.pointsAwarded })}
          </Badge>
        </div>
      </div>

      {/* Options display (read-only) */}
      {answer.question.options.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {answer.question.options.map((opt, oi) => {
            const isUserSelected =
              answer.selectedOption?.id === opt.id ||
              (answer.question.type === "multiple_choice" &&
                answer.selectedOptionId === opt.id);
            const isCorrect = opt.isCorrect;
            return (
              <li
                key={oi}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  isCorrect
                    ? "border-success/40 bg-success/5"
                    : isUserSelected
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border"
                }`}
              >
                <span className="flex-1 text-foreground">{opt.label}</span>
                {isCorrect ? (
                  <Badge variant="success" size="sm">
                    <CheckCircle2 className="size-3" />
                    {t("correct")}
                  </Badge>
                ) : null}
                {isUserSelected && !isCorrect ? (
                  <Badge variant="destructive" size="sm">
                    <XCircle className="size-3" />
                    {t("yourAnswer")}
                  </Badge>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("yourAnswer")}:
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {answer.answerText?.trim() || t("noAnswer")}
            </p>
          </div>
        </div>
      )}

      {/* Explanation */}
      {answer.question.explanation ? (
        <div className="mt-3 rounded-lg border border-info/30 bg-info/5 px-3 py-2">
          <p className="text-xs font-medium text-info">
            {t("explanationLabel")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {answer.question.explanation}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* -- Meta helper -------------------------------------------- */

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}
