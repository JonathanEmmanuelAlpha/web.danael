"use client";

/**
 * Diagnostic assessment page (client component).
 *
 * Phase 1: fetches questions via `startDiagnosticAction()` on mount.
 * Phase 2: renders the DiagnosticSession runner.
 *
 * Loading / empty / error states are handled here; the actual question
 * flow + results are delegated to <DiagnosticSession />.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ClipboardCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { startDiagnosticAction } from "@/server/actions/learning";
import { DiagnosticSession } from "@/components/learning/diagnostic-session";
import type { DiagnosticQuestion } from "@/server/services/learning";

type LoadState = "loading" | "ready" | "error" | "empty";

export default function DiagnosticPage() {
  const t = useTranslations("Learning");
  const [state, setState] = React.useState<LoadState>("loading");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [questions, setQuestions] = React.useState<DiagnosticQuestion[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    startDiagnosticAction({})
      .then((res) => {
        if (cancelled) return;
        if (!res.success || !res.data) {
          setState("error");
          return;
        }
        setSessionId(res.data.sessionId);
        setQuestions(res.data.questions);
        setState(res.data.questions.length === 0 ? "empty" : "ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="shrink-0"
          >
            <Link href="/learning">
              <ArrowLeft className="size-4" />
              {t("backToLearning")}
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="glass relative flex size-12 shrink-0 items-center justify-center rounded-xl text-primary-400 glow-primary-sm">
              <ClipboardCheck className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
                {t("diagnosticTitle")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("diagnosticSubtitle")}
              </p>
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-border-strong to-transparent"
        />
      </div>

      {/* Body */}
      {state === "loading" && (
        <div className="mx-auto max-w-3xl">
          <div className="glass-card rounded-xl p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-primary-400" />
              <p className="text-sm text-muted-foreground">
                {t("diagnosticLoading")}
              </p>
            </div>
            <div className="mt-6 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-1/3" />
            </div>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="mx-auto max-w-2xl">
          <Card className="flex flex-col items-center rounded-2xl p-8 text-center">
            <div className="glass flex size-14 items-center justify-center rounded-xl text-accent-coral-400 glow-coral">
              <AlertCircle className="size-7" />
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
              {t("diagnosticError")}
            </h2>
            <Button
              variant="brand"
              size="sm"
              className="mt-5"
              onClick={() => window.location.reload()}
            >
              {t("diagnosticLoading")}
            </Button>
          </Card>
        </div>
      )}

      {state === "empty" && (
        <div className="mx-auto max-w-2xl">
          <Card className="flex flex-col items-center rounded-2xl p-8 text-center">
            <div className="glass flex size-14 items-center justify-center rounded-xl text-muted-foreground">
              <ClipboardCheck className="size-7" />
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
              {t("diagnosticEmpty")}
            </h2>
            <Button asChild variant="brand-outline" size="sm" className="mt-5">
              <Link href="/learning">{t("backToLearning")}</Link>
            </Button>
          </Card>
        </div>
      )}

      {state === "ready" && sessionId && (
        <DiagnosticSession sessionId={sessionId} questions={questions} />
      )}
    </div>
  );
}
