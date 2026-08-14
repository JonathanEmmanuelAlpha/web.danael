"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, HelpCircle as QuizIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { listForTeacherAction, deleteQuizAction } from "@/server/actions/quizzes";
import type { QuizListItem } from "@/server/services/quizzes";

/**
 * §5.6 — Teacher quiz list.
 */
export function TeacherQuizzesList({ teacherId }: { teacherId: string }) {
  const t = useTranslations("Quizzes");
  const router = useRouter();

  const [items, setItems] = useState<QuizListItem[] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listForTeacherAction({
      page: 1,
      pageSize: 100,
      teacherId,
    }).then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data.items : []);
    });
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  async function handleDelete() {
    if (!deleteId) return;
    setPending(true);
    const result = await deleteQuizAction(deleteId);
    setPending(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("deleteQuiz"));
      return;
    }
    toast.success(t("quizDeleted"));
    setItems((prev) =>
      prev ? prev.filter((q) => q.id !== deleteId) : prev,
    );
    setDeleteId(null);
  }

  if (items === null) {
    return <GridSkeleton count={6} columns={3} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={QuizIcon}
        title={t("noQuizzes")}
        description={t("noQuizzesHint")}
        action={{ href: "/quizzes/new", label: t("create") }}
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
              variant="teacher"
              onDelete={(id) => setDeleteId(id)}
            />
          </li>
        ))}
      </ul>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteQuiz")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("backToQuizzes")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("deleteQuiz")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Header action ────────────────────────────────────────── */

export function CreateQuizButton() {
  const t = useTranslations("Quizzes");
  return (
    <Button asChild variant="brand">
      <Link href="/quizzes/new">
        <Plus className="size-4" />
        {t("create")}
      </Link>
    </Button>
  );
}
