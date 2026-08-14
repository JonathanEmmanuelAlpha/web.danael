"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Clock, CheckCircle2, Send } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { GridSkeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { AssignmentCard } from "@/components/assignments/assignment-card";
import { listForStudentAction } from "@/server/actions/assignments";
import type { AssignmentForStudent } from "@/server/services/assignments";

/**
 * §5.5 — Student assignments list (client-side fetch).
 *
 * Renders:
 *  - Stat cards: to_do / submitted / graded
 *  - The list of assignments (cards) with submission status badges
 *  - An empty state when there are no assignments
 */
export function StudentAssignmentsList() {
  const t = useTranslations("Assignments");
  const [items, setItems] = useState<AssignmentForStudent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listForStudentAction().then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <GridSkeleton count={3} columns={3} />
        </div>
        <GridSkeleton count={6} columns={3} />
      </div>
    );
  }

  const toDo = items.filter(
    (i) => !i.mySubmission || i.mySubmission.status === "not_started",
  ).length;
  const submitted = items.filter(
    (i) =>
      i.mySubmission &&
      (i.mySubmission.status === "submitted" || i.mySubmission.status === "late"),
  ).length;
  const graded = items.filter(
    (i) =>
      i.mySubmission &&
      (i.mySubmission.status === "graded" || i.mySubmission.status === "returned"),
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("notStarted")}
          value={toDo}
          icon={Clock}
          accent="amber"
        />
        <StatCard
          label={t("submitted")}
          value={submitted}
          icon={Send}
          accent="primary"
        />
        <StatCard
          label={t("graded")}
          value={graded}
          icon={CheckCircle2}
          accent="emerald"
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("noAssignmentsStudent")}
          description={t("noAssignmentsStudentHint")}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((assignment) => (
            <li key={assignment.id}>
              <AssignmentCard assignment={assignment} variant="student" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
