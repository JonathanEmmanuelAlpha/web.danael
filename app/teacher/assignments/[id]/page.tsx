import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AssignmentStatusBadge } from "@/components/assignments/assignment-status-badge";
import { AssignmentItemsList } from "@/components/assignments/assignment-items-list";
import { SubmissionStatusBadge } from "@/components/assignments/submission-status-badge";
import { SubmissionsList } from "@/components/assignments/submissions-list";
import { SubmissionForm } from "@/components/assignments/submission-form";
import { StudentSubmissionActions } from "@/components/assignments/student-submission-actions";
import { PublishAssignmentButton, ArchiveAssignmentButton } from "@/components/assignments/publish-archive-buttons";
import { getAssignmentAction, getSubmissionAction } from "@/server/actions/assignments";
import { isClassMember, isClassTeacher } from "@/server/permissions";
import { getDb } from "@/server/db";
import { eq, and } from "drizzle-orm";
import { submissions } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Users,
  CheckCircle2,
  CalendarClock,
  BookOpen,
  ArrowLeft,
  Award,
  Inbox,
  Pencil,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";
import type { SubmissionWithRelations } from "@/server/services/assignments";

/**
 * §5.5 — Assignment detail page (shared by teachers and students).
 *
 * Layout depends on the viewer's role:
 *  - teacher / school_admin / platform_admin: full detail with items +
 *    submissions list + grading interface.
 *  - student: detail + items + own submission form / feedback.
 *
 * Resolves to `/assignments/[id]` (single route group, no conflict).
 */
export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const t = await getTranslations("Assignments");
  const tNav = await getTranslations("Navigation");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  const res = await getAssignmentAction(id);
  if (!res.success || !res.data) {
    notFound();
  }
  const assignment = res.data;

  const dueAt = assignment.dueAt ? new Date(assignment.dueAt) : null;
  const isLate = dueAt ? dueAt.getTime() < Date.now() : false;

  /* ── Teacher / school admin / platform admin view ───────── */

  if (role === "teacher" || role === "school_admin" || role === "platform_admin") {
    const canManage =
      assignment.teacherId === user.id ||
      role === "platform_admin" ||
      role === "school_admin" ||
      (await isClassTeacher(user.id, assignment.classId));

    const teacherName =
      assignment.teacher &&
      [assignment.teacher.firstName, assignment.teacher.lastName]
        .filter(Boolean)
        .join(" ");

    return (
      <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
        <div className="space-y-6">
          <PageHeader
            title={assignment.title}
            description={assignment.description ?? undefined}
            icon={<ClipboardList className="size-6" />}
            breadcrumbs={
              <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <Link href="/teacher-assignments" className="hover:text-foreground hover:underline">
                  {tNav("assignments")}
                </Link>
                <span aria-hidden>/</span>
                <span className="truncate text-foreground">{assignment.title}</span>
              </nav>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <AssignmentStatusBadge status={assignment.status} size="lg" />
                {canManage && assignment.status === "draft" && (
                  <PublishAssignmentButton assignmentId={assignment.id} />
                )}
                {canManage && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/assignments/${assignment.id}/edit`}>
                      <Pencil className="size-4" />
                      {t("edit")}
                    </Link>
                  </Button>
                )}
                {canManage && assignment.status !== "archived" && (
                  <ArchiveAssignmentButton assignmentId={assignment.id} />
                )}
              </div>
            }
          />

          {/* Meta line */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {assignment.class ? (
              <Badge variant="secondary">
                <Users className="size-3" />
                {assignment.class.name}
              </Badge>
            ) : null}
            {assignment.subject ? (
              <Badge variant="brand">
                <BookOpen className="size-3" />
                {assignment.subject.name}
              </Badge>
            ) : null}
            {assignment.points ? (
              <Badge variant="outline">
                {t("pointsValue", { count: assignment.points })}
              </Badge>
            ) : null}
            {dueAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                {dueAt.toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
            {teacherName ? (
              <span className="text-xs">
                {t("student")}: <span className="text-foreground">{teacherName}</span>
              </span>
            ) : null}
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={t("submissions")}
              value={assignment.submissionsCount}
              icon={ClipboardList}
              accent="primary"
            />
            <StatCard
              label={t("graded")}
              value={assignment.gradedCount}
              icon={CheckCircle2}
              accent="emerald"
            />
            <StatCard
              label={t("averageScore")}
              value="—"
              icon={Award}
              accent="amber"
            />
          </div>

          {/* Description */}
          {assignment.description ? (
            <SectionCard title={t("description")}>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                {assignment.description}
              </p>
            </SectionCard>
          ) : null}

          {/* Items */}
          <SectionCard
            title={t("items")}
            description={t("itemsHint")}
            icon={<BookOpen className="size-4" />}
          >
            <AssignmentItemsList items={assignment.items} />
          </SectionCard>

          {/* Submissions */}
          <SectionCard
            title={t("submissions")}
            description={t("submissionsCount", {
              count: assignment.submissionsCount,
            })}
            icon={<Users className="size-4" />}
          >
            {assignment.status === "draft" ? (
              <EmptyState
                icon={ClipboardList}
                title={t("noSubmissions")}
                description={t("noSubmissionsHint")}
              />
            ) : (
              <SubmissionsList
                assignmentId={assignment.id}
                maxPoints={assignment.points ?? undefined}
              />
            )}
          </SectionCard>

          <div className="flex justify-start">
            <Button asChild variant="ghost" size="sm">
              <Link href="/teacher-assignments">
                <ArrowLeft className="size-4" />
                {tNav("assignments")}
              </Link>
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  /* ── Student view ──────────────────────────────────────── */

  // At this point `role` is narrowed to the remaining roles
  // (student / parent / tutor / content_moderator / support).
  // Permission: the student must be a member of the assignment's class.
  const member = await isClassMember(user.id, assignment.classId);
  if (!member) {
    notFound();
  }

  // Look up the student's submission directly (server-side).
  const db = await getDb();
  const subRows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, id),
        eq(submissions.studentId, user.id),
      ),
    )
    .limit(1);
  const mySubmissionRow = subRows.at(0) ?? null;
  const mySubmission: SubmissionWithRelations | null = mySubmissionRow
    ? await getSubmissionAction(mySubmissionRow.id).then((r) =>
        r.success ? r.data : null,
      )
    : null;

  const isGraded =
    mySubmission?.status === "graded" || mySubmission?.status === "returned";
  const canSubmit = assignment.status === "published" || assignment.status === "closed";

  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          title={assignment.title}
          description={assignment.description ?? undefined}
          icon={<ClipboardList className="size-6" />}
          breadcrumbs={
            <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Link href="/teacher-assignments" className="hover:text-foreground hover:underline">
                {tNav("assignments")}
              </Link>
              <span aria-hidden>/</span>
              <span className="truncate text-foreground">{assignment.title}</span>
            </nav>
          }
          actions={
            mySubmission ? (
              <SubmissionStatusBadge status={mySubmission.status} size="lg" />
            ) : null
          }
        />

        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {assignment.class ? (
            <Badge variant="secondary">
              <Users className="size-3" />
              {assignment.class.name}
            </Badge>
          ) : null}
          {assignment.subject ? (
            <Badge variant="brand">
              <BookOpen className="size-3" />
              {assignment.subject.name}
            </Badge>
          ) : null}
          {assignment.points ? (
            <Badge variant="outline">
              {t("pointsValue", { count: assignment.points })}
            </Badge>
          ) : null}
          {dueAt ? (
            <span
              className={`inline-flex items-center gap-1.5 ${
                isLate ? "font-semibold text-destructive" : ""
              }`}
            >
              <CalendarClock className="size-3.5" />
              {dueAt.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>

        {/* Description */}
        {assignment.description ? (
          <SectionCard title={t("description")}>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {assignment.description}
            </p>
          </SectionCard>
        ) : null}

        {/* Items */}
        <SectionCard
          title={t("items")}
          description={t("itemsHint")}
          icon={<BookOpen className="size-4" />}
        >
          <AssignmentItemsList items={assignment.items} />
        </SectionCard>

        {/* Submission form / feedback */}
        {isGraded && mySubmission ? (
          <SectionCard
            title={t("feedbackFromTeacher")}
            icon={<Award className="size-4" />}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{t("score")}:</span>
                <Badge variant="success" size="lg">
                  {mySubmission.score ?? t("noGrade")}
                  {assignment.points ? ` / ${assignment.points}` : ""}
                </Badge>
                <span className="ml-auto">
                  <SubmissionStatusBadge status={mySubmission.status} />
                </span>
              </div>
              {mySubmission.feedback ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {mySubmission.feedback}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noFeedback")}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/teacher-assignments">
                    <ArrowLeft className="size-4" />
                    {tNav("assignments")}
                  </Link>
                </Button>
                {mySubmission.status === "returned" && (
                  <StudentSubmissionActions
                    assignmentId={assignment.id}
                    submissionId={mySubmission.id}
                    allowLate={assignment.allowLateSubmission}
                    isLate={isLate}
                    editLabel={t("resubmit")}
                  />
                )}
              </div>
            </div>
          </SectionCard>
        ) : canSubmit ? (
          <SectionCard
            title={t("submission")}
            description={t("filesHint")}
            icon={<ClipboardList className="size-4" />}
          >
            <SubmissionForm
              assignmentId={assignment.id}
              existingSubmission={mySubmission ?? undefined}
              allowLate={assignment.allowLateSubmission}
              isLate={isLate}
            />
          </SectionCard>
        ) : (
          <EmptyState
            icon={Inbox}
            title={t("noSubmissions")}
            description={t("noSubmissionsHint")}
          />
        )}

        {/* Files submitted (read-only) */}
        {mySubmission && mySubmission.files.length > 0 && !isGraded && (
          <SectionCard title={t("files")} icon={<CheckCircle2 className="size-4" />}>
            <ul className="space-y-1.5">
              {mySubmission.files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <BookOpen className="size-4 text-muted-foreground" />
                  <a
                    href={`/api/files/download-url?key=${encodeURIComponent(file.key)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
                  >
                    {file.originalName}
                  </a>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {Math.round(file.size / 1024)} KB
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </DashboardShell>
  );
}
