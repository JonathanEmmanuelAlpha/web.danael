"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { QuestionSourceBadge } from "./question-source-badge";
import type {
  QuestionSourceValue,
  DifficultyValue,
} from "@/server/db/schema/enums";

/* -- Types --------------------------------------------------- */

export interface QuestionCardOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface QuestionCardQuestion {
  id: string;
  label: string;
  type: string;
  source: QuestionSourceValue;
  difficulty?: string | null;
  explanation?: string | null;
  options?: QuestionCardOption[];
}

interface QuestionCardProps {
  question: QuestionCardQuestion;
  /** Index for display (1-based). When omitted, no number is rendered. */
  index?: number;
  /** Show the explanation block (for review / validation mode). */
  showExplanation?: boolean;
  /** Currently selected option (single_choice / true_false). */
  selectedOptionId?: string;
  /** Currently selected options (multiple_choice). */
  selectedOptionIds?: string[];
  /** Whether this question is read-only (no interaction). */
  readOnly?: boolean;
  /** Called when an option is selected (single_choice / true_false). */
  onSelect?: (optionId: string) => void;
  /** Called when an option is toggled (multiple_choice). */
  onToggleOption?: (optionId: string) => void;
  /** Render extra badges next to the source badge (e.g. type, difficulty). */
  extraBadges?: React.ReactNode;
  /** Render an actions row at the bottom (Edit / Verify / Delete buttons). */
  actions?: React.ReactNode;
  /** Optional header slot (e.g. for the skill name). */
  header?: React.ReactNode;
  /** Optional className on the root element. */
  className?: string;
}

const DIFFICULTY_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "outline"
> = {
  easy: "success",
  medium: "warning",
  hard: "destructive",
  expert: "outline",
};

/**
 * §5.6 / §10.4 — Reusable question card.
 *
 * Used in:
 *  - Quiz detail views (read-only display of the question + its options)
 *  - Diagnostic sessions (interactive, single answer per question)
 *  - Warm-up sessions (interactive)
 *  - Teacher question validation (read-only with explanation + actions)
 *
 * Always renders the `QuestionSourceBadge` so the source of the question is
 * visible everywhere.
 *
 * The card itself has no chrome — it's a flex column with the question label
 * at the top, the option/input area in the middle, and an optional actions
 * row at the bottom. Callers wrap it in their own container (e.g. `glass-card`).
 */
export function QuestionCard({
  question,
  index,
  showExplanation = false,
  selectedOptionId,
  selectedOptionIds,
  readOnly = false,
  onSelect,
  onToggleOption,
  extraBadges,
  actions,
  header,
  className,
}: QuestionCardProps) {
  const t = useTranslations("Quizzes");

  const difficulty = (question.difficulty ?? "medium") as
    | DifficultyValue
    | string;
  const difficultyLabel = t.has(`difficulties.${difficulty}` as never)
    ? t(`difficulties.${difficulty}` as never)
    : String(difficulty);

  return (
    <article
      className={cn(
        "glass-card flex flex-col gap-4 rounded-2xl p-5",
        className,
      )}
    >
      {/* -- Header (badges + skill) ------------------------------- */}
      {header ? (
        <div className="text-xs text-muted-foreground">{header}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {typeof index === "number" ? (
          <span className="inline-flex size-7 items-center justify-center rounded-full border border-primary-500/30 bg-primary-500/10 text-xs font-semibold text-primary-300">
            {index}
          </span>
        ) : null}
        <QuestionSourceBadge source={question.source} />
        <Badge variant="outline" size="sm">
          {t.has(`questionTypes.${question.type}` as never)
            ? t(`questionTypes.${question.type}` as never)
            : question.type}
        </Badge>
        {question.difficulty ? (
          <Badge
            variant={DIFFICULTY_VARIANT[difficulty] ?? "outline"}
            size="sm"
          >
            {difficultyLabel}
          </Badge>
        ) : null}
        {extraBadges}
      </div>

      {/* -- Question label ---------------------------------------- */}
      <p className="font-display text-base font-semibold leading-snug text-foreground">
        {question.label}
      </p>

      {/* -- Options / input --------------------------------------- */}
      <QuestionBody
        question={question}
        selectedOptionId={selectedOptionId}
        selectedOptionIds={selectedOptionIds}
        readOnly={readOnly}
        onSelect={onSelect}
        onToggleOption={onToggleOption}
      />

      {/* -- Explanation ------------------------------------------- */}
      {showExplanation && question.explanation ? (
        <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-300">
            {t("explanationLabel")}
          </p>
          <p className="mt-1 text-sm text-foreground/90">
            {question.explanation}
          </p>
        </div>
      ) : null}

      {/* -- Actions ----------------------------------------------- */}
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {actions}
        </div>
      ) : null}
    </article>
  );
}

/* -- Body (the options / input area) ------------------------- */

interface QuestionBodyProps {
  question: QuestionCardQuestion;
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  readOnly?: boolean;
  onSelect?: (optionId: string) => void;
  onToggleOption?: (optionId: string) => void;
}

function QuestionBody({
  question,
  selectedOptionId,
  selectedOptionIds,
  readOnly = false,
  onSelect,
  onToggleOption,
}: QuestionBodyProps) {
  const t = useTranslations("Quizzes");

  /* -- single_choice ---------------------------------------- */
  if (question.type === "single_choice") {
    return (
      <RadioGroup
        value={selectedOptionId ?? ""}
        onValueChange={(v) => onSelect?.(v)}
        disabled={readOnly}
        className="gap-2"
      >
        {(question.options ?? []).map((opt, idx) => {
          const selected = selectedOptionId === opt.id;
          return (
            <label
              key={opt.id}
              htmlFor={`qc-sc-${question.id}-${idx}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/60 p-3 transition",
                "hover:border-primary-500/40 hover:bg-primary-500/5",
                selected && "border-primary-500 bg-primary-500/5",
                readOnly &&
                  "cursor-default opacity-80 hover:border-border hover:bg-transparent",
              )}
            >
              <RadioGroupItem
                value={opt.id}
                id={`qc-sc-${question.id}-${idx}`}
                className="mt-1"
                disabled={readOnly}
              />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={`qc-sc-${question.id}-${idx}`}
                  className="block cursor-pointer text-sm font-medium text-foreground"
                >
                  {opt.label}
                </Label>
              </div>
              {readOnly && opt.isCorrect ? (
                <Badge variant="success" size="sm">
                  <Check className="size-3" />
                  {t("correct")}
                </Badge>
              ) : null}
              {readOnly && selected && !opt.isCorrect ? (
                <Badge variant="destructive" size="sm">
                  <X className="size-3" />
                  {t("incorrect")}
                </Badge>
              ) : null}
            </label>
          );
        })}
      </RadioGroup>
    );
  }

  /* -- true_false ------------------------------------------- */
  if (question.type === "true_false") {
    return (
      <RadioGroup
        value={selectedOptionId ?? ""}
        onValueChange={(v) => onSelect?.(v)}
        disabled={readOnly}
        className="grid grid-cols-2 gap-3"
      >
        {(question.options ?? []).map((opt, idx) => {
          const selected = selectedOptionId === opt.id;
          return (
            <label
              key={opt.id}
              htmlFor={`qc-tf-${question.id}-${idx}`}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background/60 p-3 transition",
                "hover:border-primary-500/40 hover:bg-primary-500/5",
                selected && "border-primary-500 bg-primary-500/5",
                readOnly &&
                  "cursor-default opacity-80 hover:border-border hover:bg-transparent",
              )}
            >
              <RadioGroupItem
                value={opt.id}
                id={`qc-tf-${question.id}-${idx}`}
                disabled={readOnly}
              />
              <span className="text-sm font-semibold text-foreground">
                {opt.label}
              </span>
              {readOnly && opt.isCorrect ? (
                <Badge variant="success" size="sm">
                  <Check className="size-3" />
                  {t("correct")}
                </Badge>
              ) : null}
            </label>
          );
        })}
      </RadioGroup>
    );
  }

  /* -- multiple_choice --------------------------------------- */
  if (question.type === "multiple_choice") {
    const selected = selectedOptionIds ?? [];
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((opt, idx) => {
          const checked = selected.includes(opt.id);
          return (
            <label
              key={opt.id}
              htmlFor={`qc-mc-${question.id}-${idx}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/60 p-3 transition",
                "hover:border-primary-500/40 hover:bg-primary-500/5",
                checked && "border-primary-500 bg-primary-500/5",
                readOnly &&
                  "cursor-default opacity-80 hover:border-border hover:bg-transparent",
              )}
            >
              <Checkbox
                id={`qc-mc-${question.id}-${idx}`}
                checked={checked}
                onCheckedChange={() => onToggleOption?.(opt.id)}
                disabled={readOnly}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={`qc-mc-${question.id}-${idx}`}
                  className="block cursor-pointer text-sm font-medium text-foreground"
                >
                  {opt.label}
                </Label>
              </div>
              {readOnly && opt.isCorrect ? (
                <Badge variant="success" size="sm">
                  <Check className="size-3" />
                  {t("correct")}
                </Badge>
              ) : null}
              {readOnly && checked && !opt.isCorrect ? (
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

  /* -- short_answer / essay ----------------------------------- */
  return (
    <Textarea
      value={selectedOptionId ?? ""}
      onChange={(e) => onSelect?.(e.target.value)}
      disabled={readOnly}
      placeholder={t("questionLabelPlaceholder")}
      maxLength={500}
      rows={2}
      className="resize-none"
    />
  );
}
