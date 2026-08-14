"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Send, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  publishQuizAction,
} from "@/server/actions/quizzes";
import { formatTime } from "@/stores/quiz-session-store";
import Link from "next/link";

interface PublishQuizButtonProps {
  quizId: string;
  published: boolean;
}

/**
 * §5.6 — Button to publish / unpublish a quiz (with confirmation dialog).
 */
export function PublishQuizButton({ quizId, published }: PublishQuizButtonProps) {
  const t = useTranslations("Quizzes");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggle(publish: boolean) {
    setPending(true);
    const result = await publishQuizAction(quizId, publish);
    setPending(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("publish"));
      return;
    }
    toast.success(publish ? t("quizPublished") : t("quizUnpublished"));
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={published ? "outline" : "brand"}
          size="sm"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {published ? t("unpublish") : t("publish")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {published ? t("unpublish") : t("publish")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {published ? t("publishConfirm") : t("publishConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("backToQuizzes")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleToggle(!published);
            }}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {published ? t("unpublish") : t("publish")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── Sessions list (client, with link to results) ──────────── */

interface QuizSessionsListProps {
  sessions: Array<{
    id: string;
    userName: string;
    status: "in_progress" | "completed" | "abandoned" | "expired";
    totalScore: number;
    maxScore: number;
    timeSpent: number;
    completedAt: string | null;
  }>;
  passingScore: number;
}

export function QuizSessionsList({
  sessions,
  passingScore,
}: QuizSessionsListProps) {
  const t = useTranslations("Quizzes");

  return (
    <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {sessions.map((s) => {
        const percentage =
          s.maxScore > 0 ? Math.round((s.totalScore / s.maxScore) * 100) : 0;
        const passed = percentage >= passingScore;
        return (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {s.userName}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.completedAt
                  ? new Date(s.completedAt).toLocaleString()
                  : t("sessionStatus.in_progress")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge
                variant={
                  s.status === "completed"
                    ? "success"
                    : s.status === "in_progress"
                      ? "info"
                      : "warning"
                }
                size="sm"
              >
                {t(`sessionStatus.${s.status}` as const)}
              </Badge>
              {s.status === "completed" ? (
                <>
                  <Badge
                    variant={passed ? "success" : "destructive"}
                    size="sm"
                  >
                    {percentage}%
                  </Badge>
                  <Badge variant="secondary" size="sm">
                    {formatTime(s.timeSpent)}
                  </Badge>
                </>
              ) : null}
              {s.status === "completed" ? (
                <Button asChild variant="ghost" size="icon" aria-label={t("viewResults")}>
                  <Link href={`/quizzes/session/${s.id}/results`}>
                    <Eye className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
