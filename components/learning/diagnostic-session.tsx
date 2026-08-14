"use client";

/**
 * Diagnostic session runner — state machine: "question" → "results".
 *
 * Receives questions + sessionId as props (fetched by the parent page via
 * `startDiagnosticAction`). Manages:
 *  - current question index (with smooth transitions)
 *  - per-question answer state (selectedOptionId OR answerText)
 *  - 15-min timer (auto-submit on expiry)
 *  - submission via `submitDiagnosticAction`
 *  - results screen (score + "Générer mon plan" CTA)
 *
 * Aurora Navy: glass-card question card, primary-glow progress bar,
 * animate-fade-up between questions.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Loader2,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { submitDiagnosticAction } from "@/server/actions/learning";
import type { DiagnosticQuestion } from "@/server/services/learning";

/* ── Types ──────────────────────────────────────────────────── */

type SessionState = "question" | "submitting" | "results" | "error";

interface AnswerDraft {
  questionId: string;
  selectedOptionIds: string[];
  answerText: string;
  startedAt: number;
}

/* ── Helpers ────────────────────────────────────────────────── */

const TIMER_SECONDS = 15 * 60; // 15 minutes

function formatTime(secondsLeft: number): string {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function questionTypeLabel(type: string, t: (k: string) => string): string {
  switch (type) {
    case "single_choice":
    case "multiple_choice":
      return t("diagnosticSelectAnswer");
    case "true_false":
      return t("diagnosticSelectAnswer");
    case "short_answer":
      return t("diagnosticTypeAnswer");
    default:
      return t("diagnosticYourAnswer");
  }
}

/* ── Component ──────────────────────────────────────────────── */

export interface DiagnosticSessionProps {
  sessionId: string;
  questions: DiagnosticQuestion[];
  className?: string;
}

export function DiagnosticSession({
  sessionId,
  questions,
  className,
}: DiagnosticSessionProps) {
  const t = useTranslations("Learning");
  const router = useRouter();

  const [state, setState] = React.useState<SessionState>("question");
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, AnswerDraft>>(
    () => {
      const init: Record<string, AnswerDraft> = {};
      for (const q of questions) {
        init[q.id] = {
          questionId: q.questionId,
          selectedOptionIds: [],
          answerText: "",
          startedAt: Date.now(),
        };
      }
      return init;
    },
  );
  const [secondsLeft, setSecondsLeft] = React.useState(TIMER_SECONDS);
  const [score, setScore] = React.useState<number | null>(null);
  const [planId, setPlanId] = React.useState<string | null>(null);

  // Timer effect — ticks down every second, auto-submits on 0.
  React.useEffect(() => {
    if (state !== "question") return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          void handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const currentQuestion = questions[currentIdx];
  const currentAnswer = currentQuestion
    ? answers[currentQuestion.id]
    : undefined;

  const isLast = currentIdx === questions.length - 1;
  const isFirst = currentIdx === 0;
  const progressPct = questions.length
    ? Math.round(((currentIdx + 1) / questions.length) * 100)
    : 0;
  const timeLow = secondsLeft <= 60;

  const isAnswered = (a?: AnswerDraft): boolean => {
    if (!a) return false;
    return a.selectedOptionIds.length > 0 || a.answerText.trim().length > 0;
  };

  function updateCurrentAnswer(
    patch: Partial<AnswerDraft>,
  ) {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] as AnswerDraft),
        ...patch,
      },
    }));
  }

  function toggleOption(optionId: string, multi: boolean) {
    if (!currentAnswer) return;
    if (multi) {
      const has = currentAnswer.selectedOptionIds.includes(optionId);
      updateCurrentAnswer({
        selectedOptionIds: has
          ? currentAnswer.selectedOptionIds.filter((id) => id !== optionId)
          : [...currentAnswer.selectedOptionIds, optionId],
      });
    } else {
      updateCurrentAnswer({ selectedOptionIds: [optionId] });
    }
  }

  function goNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  }

  async function handleSubmit(auto = false) {
    setState("submitting");
    const payload = Object.values(answers).map((a) => ({
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionIds[0],
      answerText: a.answerText.trim() || undefined,
      timeSpent: Math.round((Date.now() - a.startedAt) / 1000),
    }));
    const result = await submitDiagnosticAction({
      sessionId,
      answers: payload,
    });
    if (!result.success) {
      setState("error");
      toast.error(result.error?.message ?? t("diagnosticError"));
      if (auto) toast.info(t("diagnosticTimeLeft"));
      return;
    }
    if (!result.data) {
      setState("error");
      toast.error(t("diagnosticError"));
      return;
    }
    setScore(result.data.score);
    setPlanId(result.data.planId);
    setState("results");
    toast.success(t("diagnosticCompleted"));
  }

  /* ── Loading state (questions still fetching upstream) ───── */
  if (questions.length === 0) {
    return (
      <div className={cn("mx-auto max-w-3xl", className)}>
        <div className="glass-card rounded-xl p-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Results screen ───────────────────────────────────────── */
  if (state === "results" && score !== null) {
    const scoreColor =
      score >= 70
        ? "text-primary-400"
        : score >= 40
          ? "text-accent-amber-400"
          : "text-accent-coral-400";
    return (
      <div className={cn("mx-auto max-w-2xl", className)}>
        <div className="glass-card relative overflow-hidden rounded-2xl p-8 animate-scale-in">
          {/* Decorative halo */}
          <div
            aria-hidden
            className="halo-lime absolute -right-20 -top-20 size-60 opacity-40"
          />
          <div className="relative flex flex-col items-center text-center">
            <div className="glass flex size-16 items-center justify-center rounded-2xl text-primary-400 glow-primary">
              <Trophy className="size-8" aria-hidden />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-foreground">
              {t("diagnosticCompleted")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("diagnosticScore")}
            </p>

            {/* Big score */}
            <div className="mt-6">
              <span
                className={cn(
                  "font-mono text-6xl font-bold tabular-nums",
                  scoreColor,
                )}
                style={{
                  filter:
                    score >= 70
                      ? "drop-shadow(0 0 16px rgba(147,217,26,0.5))"
                      : score >= 40
                        ? "drop-shadow(0 0 16px rgba(251,191,36,0.4))"
                        : "drop-shadow(0 0 16px rgba(251,113,133,0.4))",
                }}
              >
                {Math.round(score)}
              </span>
              <span className="ml-1 text-2xl text-muted-foreground">%</span>
            </div>

            {/* Score bar */}
            <div className="mt-6 w-full max-w-md">
              <Progress className="h-3" value={score} />
            </div>

            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              {score >= 70
                ? t("keepGoing")
                : score >= 40
                  ? t("almostThere")
                  : t("needsWork")}
            </p>

            {/* CTAs */}
            <div className="mt-8 flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
              {planId ? (
                <Button
                  variant="brand"
                  size="lg"
                  onClick={() => router.push("/learning")}
                >
                  <Sparkles className="size-4" />
                  {t("viewFullPlan")}
                </Button>
              ) : (
                <Button variant="brand" size="lg" disabled>
                  <Loader2 className="size-4 animate-spin" />
                  {t("diagnosticGeneratingPlan")}
                </Button>
              )}
              <Button
                asChild
                variant="brand-outline"
                size="lg"
              >
                <Link href="/learning">
                  <ArrowLeft className="size-4" />
                  {t("backToLearning")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error screen ─────────────────────────────────────────── */
  if (state === "error") {
    return (
      <div className={cn("mx-auto max-w-2xl", className)}>
        <div className="glass-card flex flex-col items-center rounded-2xl p-8 text-center animate-scale-in">
          <div className="glass flex size-14 items-center justify-center rounded-xl text-accent-coral-400 glow-coral">
            <AlertCircle className="size-7" aria-hidden />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            {t("diagnosticError")}
          </h2>
          <Button
            variant="brand"
            size="sm"
            className="mt-5"
            onClick={() => setState("question")}
          >
            {t("diagnosticSubmit")}
          </Button>
        </div>
      </div>
    );
  }

  /* ── Question screen ──────────────────────────────────────── */
  const isMulti = currentQuestion?.type === "multiple_choice";
  const isShortAnswer = currentQuestion?.type === "short_answer";

  return (
    <div className={cn("mx-auto max-w-3xl", className)}>
      {/* Top progress + timer bar */}
      <div className="glass-card sticky top-2 z-10 rounded-xl p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("diagnosticQuestion")} {currentIdx + 1}
            </span>
            <span>{t("diagnosticOf")} {questions.length}</span>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono font-semibold transition-colors",
              timeLow
                ? "bg-accent-coral-500/15 text-accent-coral-300 glow-coral"
                : "bg-white/[0.04] text-muted-foreground",
            )}
          >
            <Clock className="size-3.5" />
            {formatTime(secondsLeft)}
          </div>
        </div>
        <Progress className="mt-2 h-1.5" value={progressPct} />
      </div>

      {/* Question card */}
      <div
        key={currentQuestion?.id}
        className="glass-card mt-4 rounded-xl p-6 animate-fade-up"
      >
        {/* Skill badge + difficulty */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="violet" size="sm">
            <Sparkles className="size-2.5" />
            {currentQuestion?.skillName}
          </Badge>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  i < (currentQuestion?.difficulty ?? 0)
                    ? "bg-accent-amber-400"
                    : "bg-white/[0.1]",
                )}
              />
            ))}
          </div>
        </div>

        {/* Question label */}
        <h2 className="mt-4 font-display text-lg font-semibold leading-snug text-foreground">
          {currentQuestion?.label}
        </h2>

        {/* Answer area */}
        <div className="mt-5">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {questionTypeLabel(currentQuestion?.type ?? "", t)}
          </p>

          {isShortAnswer ? (
            <Input
              value={currentAnswer?.answerText ?? ""}
              onChange={(e) => updateCurrentAnswer({ answerText: e.target.value })}
              placeholder={t("diagnosticTypeAnswer")}
              className="w-full"
              autoFocus
            />
          ) : isMulti ? (
            <div className="space-y-2">
              {currentQuestion?.options?.map((opt) => {
                const checked =
                  currentAnswer?.selectedOptionIds.includes(opt.id) ?? false;
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all",
                      checked
                        ? "border-primary-500/60 bg-primary-500/10 glow-primary-sm"
                        : "border-border bg-white/[0.02] hover:border-border-strong hover:bg-white/[0.04]",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleOption(opt.id, true)}
                    />
                    <span className="text-sm text-foreground">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <RadioGroup
              value={currentAnswer?.selectedOptionIds[0] ?? ""}
              onValueChange={(v) => toggleOption(v, false)}
              className="gap-2"
            >
              {currentQuestion?.options?.map((opt) => {
                const selected = currentAnswer?.selectedOptionIds[0] === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all",
                      selected
                        ? "border-primary-500/60 bg-primary-500/10 glow-primary-sm"
                        : "border-border bg-white/[0.02] hover:border-border-strong hover:bg-white/[0.04]",
                    )}
                  >
                    <RadioGroupItem
                      value={opt.id}
                      id={`opt-${opt.id}`}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor={`opt-${opt.id}`}
                      className="cursor-pointer text-sm font-normal text-foreground"
                    >
                      {opt.label}
                    </Label>
                  </label>
                );
              })}
            </RadioGroup>
          )}
        </div>
      </div>

      {/* Navigation footer */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={isFirst || state === "submitting"}
        >
          <ArrowLeft className="size-4" />
          {t("diagnosticPrevious")}
        </Button>

        <div className="flex items-center gap-2">
          {/* Quick question dots */}
          <div className="hidden items-center gap-1 sm:flex">
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIdx(i)}
                aria-label={`Question ${i + 1}`}
                className={cn(
                  "size-2 rounded-full transition-all",
                  i === currentIdx
                    ? "bg-primary-500 shadow-[0_0_8px_-2px_rgba(147,217,26,0.6)]"
                    : isAnswered(answers[q.id])
                      ? "bg-primary-500/40"
                      : "bg-white/[0.1]",
                )}
              />
            ))}
          </div>
        </div>

        {isLast ? (
          <Button
            variant="brand"
            size="sm"
            onClick={() => void handleSubmit(false)}
            disabled={state === "submitting"}
          >
            {state === "submitting" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {t("diagnosticSubmit")}
          </Button>
        ) : (
          <Button
            variant="brand"
            size="sm"
            onClick={goNext}
            disabled={state === "submitting"}
          >
            {t("diagnosticNext")}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
