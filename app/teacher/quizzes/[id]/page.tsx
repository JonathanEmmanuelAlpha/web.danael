import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  ListChecks,
  PencilLine,
  Users,
} from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import {
  getQuizAction,
  listSessionsForQuizAction,
} from "@/server/actions/quizzes";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuizTypeBadge } from "@/components/quiz/quiz-type-badge";
import {
  PublishQuizButton,
  QuizSessionsList,
} from "@/components/quiz/quiz-detail-actions";
import type { UserRole } from "@/types";
import type { Level } from "@/types";

/**
 * §5.6 — Teacher quiz detail page.
 *
 * Shows: quiz metadata, list of questions, sessions results.
 */
export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;

  const tQuiz = await getTranslations("Quizzes");
  const tCommon = await getTranslations("Common");
  const tClasses = await getTranslations("Classes");

  const quizRes = await getQuizAction(id);
  if (!quizRes.success) {
    if (quizRes.error.code === "NOT_FOUND") notFound();
    throw redirect("/dashboard");
  }
  const quiz = quizRes.data;

  // Only the creator (or platform_admin) can manage this quiz.
  const isOwner = quiz.createdBy === user.id || role === "platform_admin";
  if (!isOwner) {
    redirect("/quizzes");
  }

  const sessionsRes = await listSessionsForQuizAction(id);
  const sessions = sessionsRes.success ? sessionsRes.data : [];

  // Compute stats.
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const averageScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce(
            (sum, s) =>
              sum + (s.maxScore > 0 ? (s.totalScore / s.maxScore) * 100 : 0),
            0,
          ) / completedSessions.length,
        )
      : 0;
  const passRate =
    completedSessions.length > 0
      ? Math.round(
          (completedSessions.filter(
            (s) =>
              s.maxScore > 0 &&
              (s.totalScore / s.maxScore) * 100 >= (quiz.passingScore ?? 0),
          ).length /
            completedSessions.length) *
            100,
        )
      : 0;

  const level = quiz.level as Level | null;
  const levelLabel = level ? tClasses(`levelLabels.${level}` as const) : null;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={quiz.title}
          description={quiz.description ?? undefined}
          icon={<HelpCircle className="size-6" />}
          breadcrumbs={
            <Button asChild variant="ghost" size="sm">
              <Link href="/teacher-quizzes">
                <ArrowLeft className="size-4" />
                {tQuiz("backToQuizzes")}
              </Link>
            </Button>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <QuizTypeBadge type={quiz.type} />
              {quiz.isPublished ? (
                <Badge variant="success" size="default">
                  <CheckCircle2 className="size-3" />
                  {tQuiz("published")}
                </Badge>
              ) : (
                <Badge variant="outline">{tQuiz("draft")}</Badge>
              )}
              {!quiz.isPublished ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/quizzes/${quiz.id}/edit`}>
                    <PencilLine className="size-4" />
                    {tCommon("edit")}
                  </Link>
                </Button>
              ) : null}
              <PublishQuizButton
                quizId={quiz.id}
                published={quiz.isPublished}
              />
            </div>
          }
        />

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={tQuiz("questions")}
            value={quiz.questionsCount}
            icon={HelpCircle}
            accent="primary"
          />
          <StatCard
            label={tQuiz("sessions")}
            value={sessions.length}
            icon={Users}
            accent="blue"
          />
          <StatCard
            label={tQuiz("averageScore")}
            value={`${averageScore}%`}
            icon={ListChecks}
            accent="emerald"
          />
          <StatCard
            label={tQuiz("passRate")}
            value={`${passRate}%`}
            icon={CheckCircle2}
            accent="amber"
          />
        </div>

        {/* Quiz metadata */}
        <SectionCard
          title={tQuiz("title")}
          icon={<FileText className="size-5" />}
        >
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Meta label={tQuiz("subject")}>
              {quiz.subject ? quiz.subject.name : tQuiz("noSubject")}
            </Meta>
            <Meta label={tQuiz("level")}>{levelLabel ?? tCommon("none")}</Meta>
            <Meta label={tQuiz("series")}>
              {quiz.series ?? tCommon("none")}
            </Meta>
            <Meta label={tQuiz("timeLimit")}>
              {quiz.timeLimitMinutes
                ? `${quiz.timeLimitMinutes} min`
                : tCommon("none")}
            </Meta>
            <Meta label={tQuiz("passingScore")}>{quiz.passingScore}%</Meta>
            <Meta label={tQuiz("questions")}>{quiz.questionsCount}</Meta>
            <Meta label={tQuiz("score")}>
              {tQuiz("scoreValue", { score: 0, max: quiz.maxScore })}
            </Meta>
            <Meta label={tCommon("status")}>
              {quiz.isPublished ? tQuiz("published") : tQuiz("draft")}
            </Meta>
          </dl>
        </SectionCard>

        {/* Questions preview */}
        <SectionCard
          title={tQuiz("questions")}
          icon={<HelpCircle className="size-5" />}
        >
          {quiz.questions.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title={tQuiz("noQuestions")}
              description={tQuiz("noQuestionsHint")}
            />
          ) : (
            <ol className="space-y-3">
              {quiz.questions.map((q, idx) => (
                <li
                  key={q.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {tQuiz("question")} {idx + 1}
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {q.label}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge variant="secondary" size="sm">
                        {tQuiz(`questionTypes.${q.type}` as const)}
                      </Badge>
                      <Badge variant="secondary" size="sm">
                        {tQuiz("pointsAwarded", { points: q.points })}
                      </Badge>
                      <Badge variant="info" size="sm">
                        {tQuiz(`difficulties.${q.difficulty}` as const)}
                      </Badge>
                    </div>
                  </div>
                  {q.options.length > 0 ? (
                    <ul className="mt-3 space-y-1">
                      {q.options.map((opt, oi) => (
                        <li
                          key={oi}
                          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                            opt.isCorrect
                              ? "bg-success/10 text-success"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span className="flex-1">{opt.label}</span>
                          {opt.isCorrect ? (
                            <Badge variant="success" size="sm">
                              <CheckCircle2 className="size-3" />
                              {tQuiz("correct")}
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {q.explanation ? (
                    <p className="mt-3 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-xs text-foreground">
                      <span className="font-medium text-info">
                        {tQuiz("explanationLabel")}:{" "}
                      </span>
                      {q.explanation}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        {/* Sessions results */}
        <SectionCard
          title={tQuiz("sessions")}
          icon={<ListChecks className="size-5" />}
        >
          {sessions.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={tQuiz("noSessions")}
              description={tQuiz("noSessionsHint")}
            />
          ) : (
            <QuizSessionsList
              sessions={sessions.map((s) => ({
                id: s.id,
                userName:
                  [s.user.firstName, s.user.lastName]
                    .filter(Boolean)
                    .join(" ") || s.user.email,
                status: s.status,
                totalScore: s.totalScore,
                maxScore: s.maxScore,
                timeSpent: s.timeSpent,
                completedAt: s.completedAt?.toISOString() ?? null,
              }))}
              passingScore={quiz.passingScore ?? 0}
            />
          )}
        </SectionCard>
      </div>
    </>
  );
}

/* -- Meta helper -------------------------------------------- */

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
