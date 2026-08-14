"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, CheckCircle2, Clock, Send } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { GridSkeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { AssignmentCard } from "@/components/assignments/assignment-card";
import { listForTeacherAction } from "@/server/actions/assignments";
import type { AssignmentWithRelations } from "@/server/services/assignments";

/**
 * §5.5 — Teacher assignments list (client-side fetch).
 *
 * Renders:
 *  - Stat cards: total / published / drafts
 *  - The list of assignments (cards)
 *  - An empty state when there are no assignments
 */
export function TeacherAssignmentsList() {
  const t = useTranslations("Assignments");
  const [items, setItems] = useState<AssignmentWithRelations[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listForTeacherAction().then((res) => {
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

  const published = items.filter((i) => i.status === "published").length;
  const drafts = items.filter((i) => i.status === "draft").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("title")}
          value={items.length}
          icon={ClipboardList}
          accent="primary"
        />
        <StatCard
          label={t("published")}
          value={published}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label={t("draft")}
          value={drafts}
          icon={Clock}
          accent="amber"
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("noAssignments")}
          description={t("noAssignmentsHint")}
          action={{
            href: "/assignments/new",
            label: t("create"),
          }}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((assignment) => (
            <li key={assignment.id}>
              <AssignmentCard assignment={assignment} variant="teacher" />
            </li>
          ))}
        </ul>
      )}
      <Send className="sr-only" aria-hidden />
    </div>
  );
}
