"use client";

import { useTranslations } from "next-intl";
import { Check, GripVertical, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  DIFFICULTY_VALUES,
  QUIZ_QUESTION_TYPE_VALUES,
} from "@/server/db/schema/enums";
import type { QuizQuestionInput } from "@/server/validators/quizzes";

interface QuestionBuilderProps {
  index: number;
  question: QuizQuestionInput;
  onChange: (question: QuizQuestionInput) => void;
  onRemove: () => void;
}

/**
 * §5.6 — Builder for a single quiz question: type, label, points, explanation,
 * difficulty, and a dynamic list of options (with isCorrect toggle).
 *
 * For short_answer / essay types, the options list is hidden.
 */
export function QuestionBuilder({
  index,
  question,
  onChange,
  onRemove,
}: QuestionBuilderProps) {
  const t = useTranslations("Quizzes");
  const tCommon = useTranslations("Common");

  const needsOptions =
    question.type === "single_choice" ||
    question.type === "multiple_choice" ||
    question.type === "true_false";

  function update<K extends keyof QuizQuestionInput>(
    key: K,
    value: QuizQuestionInput[K],
  ) {
    onChange({ ...question, [key]: value });
  }

  function updateOption(
    optionIndex: number,
    patch: Partial<QuizQuestionInput["options"][number]>,
  ) {
    const next = question.options.map((opt, i) =>
      i === optionIndex ? { ...opt, ...patch } : opt,
    );
    onChange({ ...question, options: next });
  }

  function addOption() {
    onChange({
      ...question,
      options: [
        ...question.options,
        {
          label: "",
          isCorrect: false,
          position: question.options.length,
        },
      ],
    });
  }

  function removeOption(optionIndex: number) {
    onChange({
      ...question,
      options: question.options
        .filter((_, i) => i !== optionIndex)
        .map((opt, i) => ({ ...opt, position: i })),
    });
  }

  // When switching to true_false, auto-create True / False options if empty.
  function handleTypeChange(type: QuizQuestionInput["type"]) {
    if (type === "true_false" && question.options.length < 2) {
      onChange({
        ...question,
        type,
        options: [
          { label: t("trueFalse.true"), isCorrect: true, position: 0 },
          { label: t("trueFalse.false"), isCorrect: false, position: 1 },
        ],
      });
      return;
    }
    if (!needsOptionsFor(type)) {
      onChange({ ...question, type, options: [] });
      return;
    }
    onChange({ ...question, type });
  }

  return (
    <Card className="gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GripVertical className="size-4 text-muted-foreground" aria-hidden />
          <span>
            {t("question")} {index + 1}
          </span>
          <Badge variant="secondary" size="sm">
            {t("pointsAwarded", { points: question.points })}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={t("removeQuestion")}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        {/* Label */}
        <div className="space-y-2">
          <Label htmlFor={`q-${index}-label`}>{t("questionLabel")}</Label>
          <Textarea
            id={`q-${index}-label`}
            value={question.label}
            onChange={(e) => update("label", e.target.value)}
            placeholder={t("questionLabelPlaceholder")}
            rows={2}
            required
          />
        </div>

        {/* Type + difficulty + points */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`q-${index}-type`}>{t("questionType")}</Label>
            <Select
              value={question.type}
              onValueChange={(v) =>
                handleTypeChange(v as QuizQuestionInput["type"])
              }
            >
              <SelectTrigger id={`q-${index}-type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUIZ_QUESTION_TYPE_VALUES.map((qt) => (
                  <SelectItem key={qt} value={qt}>
                    {t(`questionTypes.${qt}` as const)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`q-${index}-difficulty`}>{t("difficulty")}</Label>
            <Select
              value={question.difficulty}
              onValueChange={(v) =>
                update("difficulty", v as (typeof DIFFICULTY_VALUES)[number])
              }
            >
              <SelectTrigger id={`q-${index}-difficulty`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_VALUES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`difficulties.${d}` as const)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`q-${index}-points`}>{t("points")}</Label>
            <Input
              id={`q-${index}-points`}
              type="number"
              min={0}
              max={100}
              value={question.points}
              onChange={(e) =>
                update("points", Math.max(0, Math.min(100, Number(e.target.value) || 0)))
              }
            />
          </div>
        </div>

        {/* Explanation */}
        <div className="space-y-2">
          <Label htmlFor={`q-${index}-explanation`}>
            {t("explanation")}{" "}
            <span className="text-xs text-muted-foreground">
              ({tCommon("optional")})
            </span>
          </Label>
          <Textarea
            id={`q-${index}-explanation`}
            value={question.explanation ?? ""}
            onChange={(e) => update("explanation", e.target.value || undefined)}
            placeholder={t("explanationPlaceholder")}
            rows={2}
            maxLength={2000}
          />
        </div>

        {/* Options */}
        {needsOptions ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("options")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={question.options.length >= 10}
              >
                <Plus className="size-3.5" />
                {t("addOption")}
              </Button>
            </div>
            {question.options.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                {t("noOptionsHint")}
              </p>
            ) : (
              <ul className="space-y-2">
                {question.options.map((opt, oi) => (
                  <li
                    key={oi}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-background px-3 py-2 transition",
                      opt.isCorrect
                        ? "border-success/40 bg-success/5"
                        : "border-border",
                    )}
                  >
                    <Checkbox
                      checked={opt.isCorrect}
                      onCheckedChange={(checked) =>
                        updateOption(oi, {
                          isCorrect: checked === true,
                        })
                      }
                      aria-label={t("markAsCorrect")}
                    />
                    <Input
                      value={opt.label}
                      onChange={(e) =>
                        updateOption(oi, { label: e.target.value })
                      }
                      placeholder={t("optionLabelPlaceholder")}
                      className="flex-1"
                    />
                    {opt.isCorrect ? (
                      <Badge variant="success" size="sm">
                        <Check className="size-3" />
                        {t("correct")}
                      </Badge>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(oi)}
                      aria-label={t("removeOption")}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function needsOptionsFor(type: QuizQuestionInput["type"]): boolean {
  return (
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "true_false"
  );
}
