"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarClock, BookOpen, Users, FileText, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssignmentStatusBadge } from "./assignment-status-badge";
import { SubmissionStatusBadge } from "./submission-status-badge";
import type {
  AssignmentWithRelations,
  AssignmentForStudent,
} from "@/server/services/assignments";

type AssignmentCardData =
  | (AssignmentWithRelations & { mySubmission?: undefined; isLate?: undefined })
  | AssignmentForStudent;

interface AssignmentCardProps {
  assignment: AssignmentCardData;
  /** Use "teacher" link target or "student" link target. */
  variant?: "teacher" | "student";
  className?: string;
}

/**
 * §5.5 — Assignment card with title, class, due date, status badge.
 *
 * Variants:
 *  - teacher: shows submissions count + graded count
 *  - student: shows student's own submission status + late indicator
 */
export function AssignmentCard({
  assignment,
  variant = "teacher",
  className,
}: AssignmentCardProps) {
  const t = useTranslations("Assignments");
  const tCommon = useTranslations("Common");

  const dueAt = assignment.dueAt ? new Date(assignment.dueAt) : null;
  const isLate = "isLate" in assignment && assignment.isLate;
  const mySubmission =
    variant === "student" && "mySubmission" in assignment
      ? assignment.mySubmission
      : null;

  return (
    <Card
      className={`group flex h-full flex-col gap-3 p-5 transition hover:border-primary-500/40 hover:shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/assignments/${assignment.id}`}
          className="min-w-0 flex-1"
        >
          <h3 className="truncate font-display text-base font-semibold text-foreground hover:text-primary-700 dark:hover:text-primary-400">
            {assignment.title}
          </h3>
          {assignment.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {assignment.description}
            </p>
          ) : null}
        </Link>
        <AssignmentStatusBadge status={assignment.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {assignment.class ? (
          <Badge variant="secondary" size="sm">
            <Users className="size-3" />
            {assignment.class.name}
          </Badge>
        ) : null}
        {assignment.subject ? (
          <Badge variant="brand" size="sm">
            <BookOpen className="size-3" />
            {assignment.subject.name}
          </Badge>
        ) : null}
        {assignment.points ? (
          <Badge variant="outline" size="sm">
            {t("pointsValue", { count: assignment.points })}
          </Badge>
        ) : null}
        {assignment.items.length > 0 ? (
          <Badge variant="outline" size="sm">
            <FileText className="size-3" />
            {t("itemsCount", { count: assignment.items.length })}
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5" />
          {dueAt ? (
            <span
              className={
                isLate
                  ? "font-semibold text-destructive"
                  : "text-foreground"
              }
            >
              {dueAt.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : (
            <span>{tCommon("none")}</span>
          )}
        </div>
      </div>

      {/* Variant-specific footer */}
      {variant === "teacher" ? (
        <div className="mt-auto flex items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            {t("submissionsCount", { count: assignment.submissionsCount })}
          </span>
          <span aria-hidden>·</span>
          <span>{t("gradedCount", { count: assignment.gradedCount })}</span>
        </div>
      ) : (
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          {mySubmission ? (
            <SubmissionStatusBadge status={mySubmission.status} />
          ) : (
            <SubmissionStatusBadge status="not_started" />
          )}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="ml-auto -mr-2 justify-end"
          >
            <Link href={`/assignments/${assignment.id}`}>
              {t("openAssignment")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </Card>
  );
}
