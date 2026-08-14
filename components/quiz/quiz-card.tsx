"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  ListChecks,
  PencilLine,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuizTypeBadge } from "./quiz-type-badge";
import type { Level } from "@/types";
import type { QuizListItem } from "@/server/services/quizzes";
import type { QuizTypeValue } from "@/server/db/schema/enums";

interface QuizCardProps {
  quiz: QuizListItem;
  variant?: "teacher" | "student";
  onStart?: (quizId: string) => void;
  onDelete?: (quizId: string) => void;
  startPending?: boolean;
}

/**
 * §5.6 — Quiz card showing the title, subject, level, question count, time limit.
 *
 * - Teacher variant: links to the quiz detail page (with edit + delete actions).
 * - Student variant: shows a "Start" button (calls onStart).
 */
export function QuizCard({
  quiz,
  variant = "teacher",
  onStart,
  onDelete,
  startPending = false,
}: QuizCardProps) {
  const t = useTranslations("Quizzes");
  const tCommon = useTranslations("Common");
  const tClasses = useTranslations("Classes");

  const level = quiz.level as Level | null;
  const levelLabel = level
    ? tClasses(`levelLabels.${level}` as const)
    : null;
  const quizType = quiz.type as QuizTypeValue;

  return (
    <Card className="group flex h-full flex-col gap-3 p-5 transition hover:border-primary-500/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold text-foreground">
            {quiz.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {quiz.subject ? quiz.subject.name : t("noSubject")}
            {levelLabel ? ` · ${levelLabel}` : ""}
            {quiz.series ? ` · ${quiz.series}` : ""}
          </p>
        </div>
        <QuizTypeBadge type={quizType} />
      </div>

      {quiz.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {quiz.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" size="sm">
          <HelpCircle className="size-3" />
          {t("questionCount", { count: quiz.questionsCount })}
        </Badge>
        {quiz.timeLimitMinutes ? (
          <Badge variant="info" size="sm">
            <Clock className="size-3" />
            {quiz.timeLimitMinutes} min
          </Badge>
        ) : null}
        {variant === "teacher" ? (
          quiz.isPublished ? (
            <Badge variant="success" size="sm">
              <CheckCircle2 className="size-3" />
              {t("published")}
            </Badge>
          ) : (
            <Badge variant="outline" size="sm">
              {t("draft")}
            </Badge>
          )
        ) : null}
        {variant === "teacher" && quiz.sessionsCount > 0 ? (
          <Badge variant="info" size="sm">
            <ListChecks className="size-3" />
            {t("sessionsCount", { count: quiz.sessionsCount })}
          </Badge>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-2">
        {variant === "teacher" ? (
          <>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="flex-1 justify-between"
            >
              <Link href={`/quizzes/${quiz.id}`}>
                {tCommon("view")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label={tCommon("edit")}>
              <Link href={`/quizzes/${quiz.id}/edit`}>
                <PencilLine className="size-4" />
              </Link>
            </Button>
            {onDelete ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("deleteQuiz")}
                onClick={() => onDelete(quiz.id)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            variant="brand"
            size="sm"
            className="w-full"
            disabled={startPending}
            onClick={() => onStart?.(quiz.id)}
          >
            {t("start")}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
