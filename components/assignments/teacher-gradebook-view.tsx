"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { BookOpen, Inbox, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { listAssignmentsAction, listSubmissionsAction } from "@/server/actions/assignments";
import { listClassesAction } from "@/server/actions/classes";
import type { AssignmentWithRelations, SubmissionWithRelations } from "@/server/services/assignments";
import type { ClassWithRelations } from "@/server/services/classes";

interface TeacherGradebookViewProps {
  teacherId: string;
}

/**
 * §5.5 — Teacher gradebook matrix.
 *
 * Builds a students × assignments matrix from:
 *  - the classes the teacher owns
 *  - the assignments in the selected class
 *  - the submissions for each assignment
 *
 * For each student × assignment cell, we display the score (or —) with a
 * link to the grading dialog (via the assignment detail page).
 */
export function TeacherGradebookView({ teacherId }: TeacherGradebookViewProps) {
  const t = useTranslations("Assignments");

  const [classes, setClasses] = useState<ClassWithRelations[] | null>(null);
  const [classId, setClassId] = useState<string>("");
  const [assignments, setAssignments] = useState<AssignmentWithRelations[] | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithRelations[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Load classes the teacher owns (single pass on mount).
  useEffect(() => {
    let cancelled = false;
    listClassesAction({ teacherId, page: 1, pageSize: 100 }).then((res) => {
      if (cancelled) return;
      const items = res.success ? res.data.items : [];
      setClasses(items);
      if (items.length > 0) {
        setClassId(items[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  // Load assignments for the selected class.
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    const load = async () => {
      const res = await listAssignmentsAction({ classId, page: 1, pageSize: 100 });
      if (cancelled) return;
      setAssignments(res.success ? res.data.items : []);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  // Load submissions for each assignment (in parallel).
  useEffect(() => {
    if (!assignments || assignments.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const results = await Promise.all(
        assignments.map((a) => listSubmissionsAction(a.id)),
      );
      if (cancelled) return;
      const all: SubmissionWithRelations[] = [];
      for (const r of results) {
        if (r.success) all.push(...r.data);
      }
      setSubmissions(all);
      setLoadingSubs(false);
    };
    Promise.resolve().then(() => {
      if (!cancelled) setLoadingSubs(true);
    });
    void load();
    return () => {
      cancelled = true;
    };
  }, [assignments]);

  // Group submissions by (assignmentId, studentId) → score
  const scoreMap = useMemo(() => {
    const map = new Map<string, SubmissionWithRelations>();
    for (const s of submissions) {
      map.set(`${s.assignmentId}:${s.student.id}`, s);
    }
    return map;
  }, [submissions]);

  // Unique list of students across all submissions.
  const students = useMemo(() => {
    const map = new Map<
      string,
      { id: string; firstName: string | null; lastName: string | null; email: string }
    >();
    for (const s of submissions) {
      if (!map.has(s.student.id)) {
        map.set(s.student.id, s.student);
      }
    }
    return Array.from(map.values());
  }, [submissions]);

  if (classes === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("gradebookEmpty")}
        description={t("gradebookEmptyHint")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Class selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("selectClass")}
          </label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="h-10 w-full sm:w-72">
              <SelectValue placeholder={t("selectClass")} />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                  {cls.academicYear ? ` · ${cls.academicYear}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {assignments === null ? (
        <Skeleton className="h-48 w-full" />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("noAssignments")}
          description={t("noAssignmentsHint")}
        />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("gradebookEmpty")}
          description={t("gradebookEmptyHint")}
        />
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          {loadingSubs ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("loadingGradebook")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card">
                    {t("studentColumn")}
                  </TableHead>
                  {assignments.map((a) => (
                    <TableHead key={a.id} className="min-w-[120px] text-center">
                      <Link
                        href={`/assignments/${a.id}`}
                        className="block truncate text-xs font-semibold text-primary-700 hover:underline dark:text-primary-400"
                        title={a.title}
                      >
                        {a.title}
                      </Link>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {a.points ? t("pointsValue", { count: a.points }) : ""}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="sticky left-0 z-10 bg-card">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary-500/10 text-xs text-primary-700 dark:text-primary-400">
                            {initials(student)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {studentName(student)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {student.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    {assignments.map((a) => {
                      const submission = scoreMap.get(`${a.id}:${student.id}`);
                      const score = submission?.score;
                      const max = a.points ?? null;
                      return (
                        <TableCell key={a.id} className="text-center">
                          {submission ? (
                            score ? (
                              <Badge variant="success" size="sm">
                                {score}
                                {max ? `/${max}` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="info" size="sm">
                                {submission.status === "late"
                                  ? t("late")
                                  : t("submitted")}
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("noGrade")}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <Button className="hidden" aria-hidden>
        <Loader2 className="size-4" />
      </Button>
    </div>
  );
}

function studentName(s: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  return [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email;
}

function initials(s: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const first = s.firstName?.[0] ?? "";
  const last = s.lastName?.[0] ?? "";
  return (first + last).toUpperCase() || s.email[0]?.toUpperCase() || "?";
}
