"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { QuizQuestionWithOptions } from "@/server/services/quizzes";
import type { QuizAnswerDraft } from "@/stores/quiz-session-store";

/* -- Types --------------------------------------------------- */

interface QuestionTypesProps {
  question: QuizQuestionWithOptions;
  value: QuizAnswerDraft | undefined;
  onChange: (answer: QuizAnswerDraft) => void;
  disabled?: boolean;
}

/* -- Component ---------------------------------------------- */

/**
 * §5.6 — Renders the appropriate input UI for the question type.
 *
 *  - single_choice → RadioGroup
 *  - true_false → RadioGroup with True / False
 *  - multiple_choice → Checkbox list
 *  - short_answer → Textarea (single line, ≤200 chars)
 *  - essay → Textarea (multi-line, ≤5000 chars)
 *
 * For `disabled` mode (used in the results view), the inputs are read-only.
 */
export function QuestionTypes({
  question,
  value,
  onChange,
  disabled = false,
}: QuestionTypesProps) {
  const t = useTranslations("Quizzes");

  /* -- single_choice ---------------------------------------- */
  if (question.type === "single_choice") {
    const selected =
      value && value.questionType === "single_choice"
        ? value.selectedOptionId
        : "";
    return (
      <RadioGroup
        value={selected}
        onValueChange={(v) =>
          onChange({
            questionType: "single_choice",
            selectedOptionId: v,
          })
        }
        disabled={disabled}
        className="gap-2"
      >
        {question.options.map((opt, idx) => (
          <label
            key={opt.id}
            htmlFor={`opt-${question.id}-${idx}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 transition",
              "hover:border-primary-500/40 hover:bg-primary-500/5",
              selected === opt.id && "border-primary-500 bg-primary-500/5",
              disabled &&
                "cursor-default opacity-70 hover:border-border hover:bg-transparent",
            )}
          >
            <RadioGroupItem
              value={opt.id}
              id={`opt-${question.id}-${idx}`}
              className="mt-1"
              disabled={disabled}
            />
            <div className="min-w-0 flex-1">
              <Label
                htmlFor={`opt-${question.id}-${idx}`}
                className="block cursor-pointer text-sm font-medium text-foreground"
              >
                {opt.label}
              </Label>
            </div>
            {disabled && opt.isCorrect ? (
              <Badge variant="success" size="sm">
                <Check className="size-3" />
                {t("correct")}
              </Badge>
            ) : null}
            {disabled && selected === opt.id && !opt.isCorrect ? (
              <Badge variant="destructive" size="sm">
                <X className="size-3" />
                {t("incorrect")}
              </Badge>
            ) : null}
          </label>
        ))}
      </RadioGroup>
    );
  }

  /* -- true_false ------------------------------------------- */
  if (question.type === "true_false") {
    const selected =
      value && value.questionType === "true_false"
        ? value.selectedOptionId
        : "";
    // Find the True / False option ids (by convention the first two options).
    const trueOpt = question.options[0];
    const falseOpt = question.options[1];

    if (!trueOpt || !falseOpt) {
      // Fallback: render as single_choice if options weren't set up properly.
      return null;
    }

    const options: Array<{ id: string; label: string; opt: typeof trueOpt }> = [
      { id: trueOpt.id, label: t("trueFalse.true"), opt: trueOpt },
      { id: falseOpt.id, label: t("trueFalse.false"), opt: falseOpt },
    ];

    return (
      <RadioGroup
        value={selected}
        onValueChange={(v) =>
          onChange({
            questionType: "true_false",
            selectedOptionId: v,
          })
        }
        disabled={disabled}
        className="grid grid-cols-2 gap-3"
      >
        {options.map(({ id, label, opt }) => (
          <label
            key={id}
            htmlFor={`tf-${question.id}-${id}`}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-border bg-background p-5 transition",
              "hover:border-primary-500/40 hover:bg-primary-500/5",
              selected === id && "border-primary-500 bg-primary-500/5",
              disabled &&
                "cursor-default opacity-70 hover:border-border hover:bg-transparent",
            )}
          >
            <RadioGroupItem
              value={id}
              id={`tf-${question.id}-${id}`}
              disabled={disabled}
            />
            <span className="text-base font-semibold text-foreground">
              {label}
            </span>
            {disabled && opt.isCorrect ? (
              <Badge variant="success" size="sm">
                <Check className="size-3" />
                {t("correct")}
              </Badge>
            ) : null}
            {disabled && selected === id && !opt.isCorrect ? (
              <Badge variant="destructive" size="sm">
                <X className="size-3" />
                {t("incorrect")}
              </Badge>
            ) : null}
          </label>
        ))}
      </RadioGroup>
    );
  }

  /* -- multiple_choice ------------------------------------- */
  if (question.type === "multiple_choice") {
    const selected =
      value && value.questionType === "multiple_choice"
        ? value.selectedOptionIds
        : [];

    function toggle(id: string) {
      if (disabled) return;
      const next = selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id];
      onChange({
        questionType: "multiple_choice",
        selectedOptionIds: next,
      });
    }

    return (
      <div className="space-y-2">
        {question.options.map((opt, idx) => {
          const checked = selected.includes(opt.id);
          return (
            <label
              key={opt.id}
              htmlFor={`mc-${question.id}-${idx}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 transition",
                "hover:border-primary-500/40 hover:bg-primary-500/5",
                checked && "border-primary-500 bg-primary-500/5",
                disabled &&
                  "cursor-default opacity-70 hover:border-border hover:bg-transparent",
              )}
            >
              <Checkbox
                id={`mc-${question.id}-${idx}`}
                checked={checked}
                onCheckedChange={() => toggle(opt.id)}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={`mc-${question.id}-${idx}`}
                  className="block cursor-pointer text-sm font-medium text-foreground"
                >
                  {opt.label}
                </Label>
              </div>
              {disabled && opt.isCorrect ? (
                <Badge variant="success" size="sm">
                  <Check className="size-3" />
                  {t("correct")}
                </Badge>
              ) : null}
              {disabled && checked && !opt.isCorrect ? (
                <Badge variant="destructive" size="sm">
                  <X className="size-3" />
                  {t("incorrect")}
                </Badge>
              ) : null}
            </label>
          );
        })}
      </div>
    );
  }

  /* -- short_answer ----------------------------------------- */
  if (question.type === "short_answer") {
    const text =
      value && value.questionType === "short_answer" ? value.answerText : "";
    return (
      <Textarea
        value={text}
        onChange={(e) =>
          onChange({
            questionType: "short_answer",
            answerText: e.target.value.slice(0, 500),
          })
        }
        disabled={disabled}
        placeholder={t("questionLabelPlaceholder")}
        maxLength={500}
        rows={2}
        className="resize-none"
      />
    );
  }

  /* -- essay ------------------------------------------------ */
  // type === "essay"
  const text = value && value.questionType === "essay" ? value.answerText : "";
  return (
    <Textarea
      value={text}
      onChange={(e) =>
        onChange({
          questionType: "essay",
          answerText: e.target.value.slice(0, 5000),
        })
      }
      disabled={disabled}
      placeholder={t("questionLabelPlaceholder")}
      maxLength={5000}
      rows={8}
      className="resize-y"
    />
  );
}
