"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, HelpCircle as QuizIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QuizCard } from "@/components/quiz/quiz-card";
import { startSessionAction } from "@/server/actions/quizzes";
import type { QuizListItem } from "@/server/services/quizzes";
import { listForStudentAction } from "@/server/actions/quizzes";

/**
 * §5.6 — Student quizzes list.
 *
 * Shows all published quizzes (with optional filters) + a "Start" button on
 * each card that calls startSessionAction then redirects to the session page.
 */
export function StudentQuizzesList({ studentId }: { studentId: string }) {
  const t = useTranslations("Quizzes");
  const router = useRouter();

  const [items, setItems] = useState<QuizListItem[] | null>(null);
  const [startId, setStartId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listForStudentAction({
      page: 1,
      pageSize: 100,
      studentId,
    }).then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data.items : []);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  async function handleStart() {
    if (!startId) return;
    setPending(true);
    const result = await startSessionAction({
      quizId: startId,
      userId: studentId,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message ?? t("start"));
      return;
    }
    toast.success(t("sessionStarted"));
    setStartId(null);
    router.push(`/quizzes/session/${result.data.id}`);
  }

  if (items === null) {
    return <GridSkeleton count={6} columns={3} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={QuizIcon}
        title={t("noQuizzesAvailable")}
        description={t("noQuizzesAvailableHint")}
      />
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((quiz) => (
          <li key={quiz.id}>
            <QuizCard
              quiz={quiz}
              variant="student"
              startPending={pending && startId === quiz.id}
              onStart={(id) => setStartId(id)}
            />
          </li>
        ))}
      </ul>

      <AlertDialog
        open={startId !== null}
        onOpenChange={(o) => !o && setStartId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("startQuiz")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("startQuizConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("backToQuizzes")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleStart();
              }}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <QuizIcon className="size-4" />
              )}
              {t("start")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
