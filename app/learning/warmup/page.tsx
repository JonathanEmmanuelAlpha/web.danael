"use client";

/**
 * Warm-up session page (client component).
 *
 * Phase 1: fetches today's warm-up via `getTodayWarmupAction()`.
 * Phase 2: if already completed → show results (score + stars).
 * Phase 3: if pending → run a 3-question self-graded session:
 *  - Question N/3 + skill badge
 *  - "J'ai trouvé" / "J'ai bloqué" buttons (self-assessment)
 *  - On finish → `completeWarmupAction` with per-question isCorrect.
 *
 * The warmup API only persists `questionIds` + `skillIds` (no question text),
 * so the UI uses a self-assessment flow which matches the action's input
 * shape (`isCorrect` per question).
 */

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  completeWarmupAction,
  getTodayWarmupAction,
} from "@/server/actions/learning";
import type { WarmupSummary } from "@/server/services/learning";

type LoadState = "loading" | "ready" | "error";
type SessionState = "intro" | "running" | "submitting" | "results";

interface QuestionAnswer {
  questionId: string;
  isCorrect: boolean | null;
  timeSpent: number;
  startedAt: number;
}

export default function WarmupPage() {
  const t = useTranslations("Learning");

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [warmup, setWarmup] = React.useState<WarmupSummary | null>(null);

  // Session state
  const [sessionState, setSessionState] = React.useState<SessionState>("intro");
  const [currentIdx, setCurrentIdx] = React.useState(0);
  // Capture the session start timestamp once (lazy initializer — impure ops
  // are allowed here). Used as the `startedAt` for every question.
  const [sessionStart] = React.useState(() => Date.now());
  // Per-question user overrides (isCorrect + timeSpent).
  const [overrides, setOverrides] = React.useState<
    Record<string, Partial<QuestionAnswer>>
  >({});
  const [finalScore, setFinalScore] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getTodayWarmupAction()
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setLoadState("error");
          return;
        }
        setWarmup(res.data);
        // If already completed → show results; else → intro screen.
        setSessionState(
          res.data?.status === "completed" ? "results" : "intro",
        );
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute the full answers map: base (from warmup + sessionStart) merged
  // with user overrides. Avoids setState-in-effect for initialization.
  const answers = React.useMemo<Record<string, QuestionAnswer>>(() => {
    if (!warmup) return {};
    const init: Record<string, QuestionAnswer> = {};
    for (const qId of warmup.questionIds) {
      init[qId] = {
        questionId: qId,
        isCorrect: null,
        timeSpent: 0,
        startedAt: sessionStart,
        ...overrides[qId],
      };
    }
    return init;
  }, [warmup, sessionStart, overrides]);

  const total = warmup?.questionIds.length ?? 3;
  const isLast = currentIdx === total - 1;
  const isFirst = currentIdx === 0;
  const progressPct = total > 0 ? Math.round(((currentIdx + 1) / total) * 100) : 0;
  const currentQuestionId = warmup?.questionIds[currentIdx];
  const currentAnswer = currentQuestionId
    ? answers[currentQuestionId]
    : undefined;
  const currentSkillId = warmup?.skillIds[currentIdx];

  function startSession() {
    setSessionState("running");
    setCurrentIdx(0);
  }

  function markAnswer(isCorrect: boolean) {
    if (!currentQuestionId || !currentAnswer) return;
    setOverrides((prev) => ({
      ...prev,
      [currentQuestionId]: {
        isCorrect,
        timeSpent: Math.round((Date.now() - currentAnswer.startedAt) / 1000),
      },
    }));
  }

  function goNext() {
    if (currentIdx < total - 1) setCurrentIdx(currentIdx + 1);
  }

  function goPrev() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  }

  async function finishSession() {
    if (!warmup) return;
    setSessionState("submitting");
    const payload = Object.values(answers).map((a) => ({
      questionId: a.questionId,
      isCorrect: Boolean(a.isCorrect),
      timeSpent: a.timeSpent,
    }));
    const result = await completeWarmupAction({
      sessionId: warmup.id,
      answers: payload,
    });
    if (!result.success) {
      setSessionState("running");
      toast.error(result.error?.message ?? t("warmup"));
      return;
    }
    if (!result.data) {
      setSessionState("running");
      toast.error(t("warmup"));
      return;
    }
    setFinalScore(result.data.score);
    setSessionState("results");
    toast.success(t("warmupDone"));
  }

  /* ── Loading ──────────────────────────────────────────────── */
  if (loadState === "loading") {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <WarmupHeader />
        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-1/3" />
          </div>
        </Card>
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────── */
  if (loadState === "error" || !warmup) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <WarmupHeader />
        <Card className="flex flex-col items-center rounded-2xl p-8 text-center">
          <div className="glass flex size-14 items-center justify-center rounded-xl text-accent-coral-400 glow-coral">
            <HelpCircle className="size-7" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            {t("warmupLoading")}
          </h2>
          <Button
            variant="brand"
            size="sm"
            className="mt-5"
            onClick={() => window.location.reload()}
          >
            {t("warmupStart")}
          </Button>
        </Card>
      </div>
    );
  }

  /* ── Results ──────────────────────────────────────────────── */
  const correctCount = finalScore !== null
    ? Math.round((finalScore / 100) * total)
    : warmup.correctCount;
  const scorePct = finalScore !== null
    ? finalScore
    : total > 0
      ? Math.round((correctCount / total) * 100)
      : 0;

  if (sessionState === "results") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <WarmupHeader />
        <Card className="relative overflow-hidden rounded-2xl p-8 animate-scale-in">
          <div
            aria-hidden
            className="halo-blue pointer-events-none absolute -right-20 -top-20 size-60 opacity-40"
          />
          <div className="relative flex flex-col items-center text-center">
            <div className="glass flex size-16 items-center justify-center rounded-2xl text-primary-400 glow-primary">
              <CheckCircle2 className="size-8" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-foreground">
              {t("warmupCompleted")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("warmupCompletedHint")}
            </p>

            {/* Score */}
            <div className="mt-6">
              <span
                className={cn(
                  "font-mono text-5xl font-bold tabular-nums",
                  scorePct >= 70
                    ? "text-primary-400"
                    : scorePct >= 40
                      ? "text-accent-amber-400"
                      : "text-accent-coral-400",
                )}
                style={{
                  filter: "drop-shadow(0 0 12px rgba(147,217,26,0.4))",
                }}
              >
                {scorePct}%
              </span>
            </div>

            {/* Stars */}
            <div className="mt-4 flex items-center gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-6 transition-all",
                    i < correctCount
                      ? "fill-accent-amber-400 text-accent-amber-400 shadow-[0_0_12px_-2px_rgba(251,191,36,0.6)]"
                      : "text-muted-foreground/30",
                  )}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild variant="brand" size="lg">
                <Link href="/learning">
                  <Sparkles className="size-4" />
                  {t("viewFullPlan")}
                </Link>
              </Button>
              <Button asChild variant="brand-outline" size="lg">
                <Link href="/dashboard">
                  <ArrowLeft className="size-4" />
                  {t("backToLearning")}
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /* ── Intro ────────────────────────────────────────────────── */
  if (sessionState === "intro") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <WarmupHeader />
        <Card className="relative overflow-hidden rounded-2xl p-8 animate-fade-up">
          <div
            aria-hidden
            className="halo-blue pointer-events-none absolute -right-16 -top-16 size-48 opacity-30"
          />
          <div className="relative flex flex-col items-center text-center">
            <div className="glass flex size-16 items-center justify-center rounded-2xl text-accent-cyan-400 glow-cyan">
              <Zap className="size-8" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-foreground">
              {t("warmup")}
            </h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {t("warmupHint")}
            </p>

            {/* Quick info */}
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HelpCircle className="size-3.5 text-accent-cyan-400" />
                {total} {t("questions")}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-accent-cyan-400" />
                ~2 {t("min")}
              </div>
            </div>

            <Button
              variant="brand"
              size="lg"
              className="mt-8"
              onClick={startSession}
            >
              <Zap className="size-4" />
              {t("warmupStart")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ── Running / submitting ─────────────────────────────────── */
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <WarmupHeader />

      {/* Progress */}
      <div className="glass-card sticky top-2 z-10 rounded-xl p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("warmupQuestion")} {currentIdx + 1}
            </span>
            <span>{t("warmupOf")} {total}</span>
          </div>
          <Badge variant="info" size="sm">
            <Clock className="size-3" />
            ~2 {t("min")}
          </Badge>
        </div>
        <Progress className="mt-2 h-1.5" value={progressPct} />
      </div>

      {/* Question card */}
      <Card
        key={currentQuestionId}
        className="relative overflow-hidden rounded-xl p-6 animate-fade-up"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-cyan-400/60 via-primary-500/30 to-transparent"
        />
        <div className="flex items-center justify-between gap-2">
          <Badge variant="violet" size="sm">
            <Sparkles className="size-2.5" />
            {t("warmupQuestion")} {currentIdx + 1}
          </Badge>
          {currentSkillId && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {currentSkillId.slice(0, 8)}
            </span>
          )}
        </div>

        <h2 className="mt-4 font-display text-lg font-semibold leading-snug text-foreground">
          {t("warmupHint")}
        </h2>

        {/* Self-assessment */}
        <div className="mt-5">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {t("warmupCorrect")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => markAnswer(true)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-5 transition-all",
                currentAnswer?.isCorrect === true
                  ? "border-primary-500/60 bg-primary-500/10 glow-primary-sm"
                  : "border-border bg-white/[0.02] hover:border-border-strong hover:bg-white/[0.04]",
              )}
            >
              <ThumbsUp
                className={cn(
                  "size-7",
                  currentAnswer?.isCorrect === true
                    ? "text-primary-400"
                    : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  currentAnswer?.isCorrect === true
                    ? "text-primary-300"
                    : "text-foreground",
                )}
              >
                {t("warmupCorrect")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => markAnswer(false)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-5 transition-all",
                currentAnswer?.isCorrect === false
                  ? "border-accent-coral-500/60 bg-accent-coral-500/10 glow-coral"
                  : "border-border bg-white/[0.02] hover:border-border-strong hover:bg-white/[0.04]",
              )}
            >
              <ThumbsDown
                className={cn(
                  "size-7",
                  currentAnswer?.isCorrect === false
                    ? "text-accent-coral-400"
                    : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  currentAnswer?.isCorrect === false
                    ? "text-accent-coral-300"
                    : "text-foreground",
                )}
              >
                {t("warmupIncorrect")}
              </span>
            </button>
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={isFirst || sessionState === "submitting"}
        >
          <ArrowLeft className="size-4" />
          {t("diagnosticPrevious")}
        </Button>

        {/* Question dots */}
        <div className="flex items-center gap-1">
          {warmup.questionIds.map((qId, i) => {
            const a = answers[qId];
            const answered = a?.isCorrect !== null && a?.isCorrect !== undefined;
            return (
              <button
                key={qId}
                type="button"
                onClick={() => setCurrentIdx(i)}
                aria-label={`Question ${i + 1}`}
                className={cn(
                  "size-2 rounded-full transition-all",
                  i === currentIdx
                    ? "bg-primary-500 shadow-[0_0_8px_-2px_rgba(147,217,26,0.6)]"
                    : answered
                      ? a?.isCorrect
                        ? "bg-primary-500/50"
                        : "bg-accent-coral-500/50"
                      : "bg-white/[0.1]",
                )}
              />
            );
          })}
        </div>

        {isLast ? (
          <Button
            variant="brand"
            size="sm"
            onClick={() => void finishSession()}
            disabled={
              sessionState === "submitting" ||
              currentAnswer?.isCorrect === null ||
              currentAnswer?.isCorrect === undefined
            }
          >
            {sessionState === "submitting" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {t("warmupFinish")}
          </Button>
        ) : (
          <Button
            variant="brand"
            size="sm"
            onClick={goNext}
            disabled={
              sessionState === "submitting" ||
              currentAnswer?.isCorrect === null ||
              currentAnswer?.isCorrect === undefined
            }
          >
            {t("warmupNext")}
            <ArrowLeft className="size-4 rotate-180" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Header ────────────────────────────────────────────────── */

function WarmupHeader() {
  const t = useTranslations("Learning");
  return (
    <div className="relative flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href="/learning">
            <ArrowLeft className="size-4" />
            {t("backToLearning")}
          </Link>
        </Button>
      </div>
      <div className="flex items-start gap-4">
        <div className="glass relative flex size-12 shrink-0 items-center justify-center rounded-xl text-accent-cyan-400 glow-cyan">
          <Zap className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {t("warmup")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("warmupHint")}</p>
        </div>
      </div>
      <div
        aria-hidden
        className="h-px w-full bg-gradient-to-r from-transparent via-border-strong to-transparent"
      />
    </div>
  );
}
