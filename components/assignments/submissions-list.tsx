"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, FileText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmissionStatusBadge } from "./submission-status-badge";
import { GradeSubmissionDialog } from "./grade-submission-dialog";
import { listSubmissionsAction } from "@/server/actions/assignments";
import type { SubmissionWithRelations } from "@/server/services/assignments";

interface SubmissionsListProps {
  assignmentId: string;
  /** Max points possible for the assignment. */
  maxPoints?: number;
  /** Called after a successful grade. */
  onGraded?: () => void;
  /** Hide the table header on mobile. */
  className?: string;
}

/**
 * §5.5 — Teacher view of all submissions for an assignment.
 *
 * Uses a responsive layout:
 *  - On desktop: a real table (student / submittedAt / score / status / actions).
 *  - On mobile: a stacked card list.
 */
export function SubmissionsList({
  assignmentId,
  maxPoints,
  onGraded,
  className,
}: SubmissionsListProps) {
  const t = useTranslations("Assignments");
  const [items, setItems] = useState<SubmissionWithRelations[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listSubmissionsAction(assignmentId).then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [assignmentId, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
    onGraded?.();
  }

  if (items === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={t("noSubmissions")}
        description={t("noSubmissionsHint")}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("studentColumn")}</TableHead>
              <TableHead>{t("dateColumn")}</TableHead>
              <TableHead className="text-right">{t("scoreColumn")}</TableHead>
              <TableHead>{t("statusColumn")}</TableHead>
              <TableHead className="text-right">{t("actionsColumn")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((submission) => (
              <TableRow key={submission.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary-500/10 text-xs text-primary-700 dark:text-primary-400">
                        {initials(submission.student)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {studentName(submission.student)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {submission.student.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {submission.submittedAt ? (
                    <span className="text-sm text-muted-foreground">
                      {new Date(submission.submittedAt).toLocaleDateString(
                        undefined,
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t("noGrade")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {submission.score ? (
                    <Badge variant="success" size="lg">
                      {submission.score}
                      {maxPoints
                        ? ` / ${maxPoints}`
                        : ""}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{t("noGrade")}</span>
                  )}
                </TableCell>
                <TableCell>
                  <SubmissionStatusBadge status={submission.status} />
                </TableCell>
                <TableCell className="text-right">
                  <GradeSubmissionDialog
                    submission={submission}
                    maxPoints={maxPoints}
                    onGraded={refresh}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 sm:hidden">
        {items.map((submission) => (
          <li key={submission.id}>
            <Card className="gap-0 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary-500/10 text-xs text-primary-700 dark:text-primary-400">
                      {initials(submission.student)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {studentName(submission.student)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {submission.student.email}
                    </p>
                  </div>
                </div>
                <SubmissionStatusBadge status={submission.status} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                {submission.score ? (
                  <Badge variant="success" size="lg">
                    {submission.score}
                    {maxPoints ? ` / ${maxPoints}` : ""}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("noGrade")}
                  </span>
                )}
                <GradeSubmissionDialog
                  submission={submission}
                  maxPoints={maxPoints}
                  onGraded={refresh}
                  trigger={
                    <Button variant="brand-outline" size="sm">
                      <FileText className="size-3.5" />
                      {t("grade")}
                    </Button>
                  }
                />
              </div>
              {submission.submittedAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("submittedAt")}{" "}
                  {new Date(submission.submittedAt).toLocaleDateString()}
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function studentName(s: SubmissionWithRelations["student"]): string {
  return (
    [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email
  );
}

function initials(s: SubmissionWithRelations["student"]): string {
  const first = s.firstName?.[0] ?? "";
  const last = s.lastName?.[0] ?? "";
  return (first + last).toUpperCase() || s.email[0]?.toUpperCase() || "?";
}

// Suppress unused warnings.
void Loader2;
