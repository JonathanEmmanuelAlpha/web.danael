"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  School,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import { listClassesAction } from "@/server/actions/classes";
import type { ClassWithRelations } from "@/server/services/classes";
import type { Level } from "@/types";
import { IconChalkboardTeacher } from "@tabler/icons-react";

interface ClassesListProps {
  schoolId?: string;
  teacherId?: string;
  studentId?: string;
  emptyTitle?: string;
  emptyHint?: string;
  showCreateButton?: boolean;
  createDialog?: React.ReactNode;
}

/**
 * §5.3 — Lists classes (filtered by school / teacher / student).
 * Each card links to the class detail page (`/classes/[id]`).
 */
export function ClassesList({
  schoolId,
  teacherId,
  studentId,
  emptyTitle,
  emptyHint,
  showCreateButton,
  createDialog,
}: ClassesListProps) {
  const t = useTranslations("Classes");
  const [items, setItems] = useState<ClassWithRelations[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listClassesAction({
      schoolId,
      teacherId,
      studentId,
      page: 1,
      pageSize: 100,
    }).then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data.items : []);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolId, teacherId, studentId]);

  if (items === null) {
    return (
      <div className="space-y-4">
        {showCreateButton && (
          <div className="flex justify-end">
            <Skeleton className="h-9 w-32" />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {showCreateButton && (
          <div className="flex justify-end">{createDialog}</div>
        )}
        <EmptyState
          icon={School}
          title={emptyTitle ?? t("noMembers")}
          description={emptyHint ?? t("noMembersHint")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showCreateButton && (
        <div className="flex justify-end">{createDialog}</div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((cls) => {
          const level = cls.level as Level | null;
          const levelLabel = level ? t(`levelLabels.${level}` as const) : null;

          const headName = cls.headTeacher
            ? [cls.headTeacher.firstName, cls.headTeacher.lastName]
                .filter(Boolean)
                .join(" ") || cls.headTeacher.email
            : null;
          const headInitials = headName
            ? headName
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : null;

          const studentsLabel = t.has("students" as never)
            ? (t("students" as never) as string)
            : "Students";
          const teachersLabel = t.has("teachers" as never)
            ? (t("teachers" as never) as string)
            : "Teachers";
          const subjectsLabel = t.has("subjects" as never)
            ? (t("subjects" as never) as string)
            : "Subjects";

          return (
            <li key={cls.id}>
              <Link
                href={`/classes/${cls.id}`}
                className="group block focus-visible:outline-none"
              >
                <Card className="p-0 relative h-full overflow-hidden rounded-2xl border-border/60 bg-card/70 backdrop-blur transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary-500/40 group-hover:shadow-lg group-hover:shadow-primary-500/10 group-focus-visible:ring-2 group-focus-visible:ring-primary-500/50">
                  {/* Hairline dégradée au survol */}
                  <div
                    aria-hidden
                    className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  {/* Halo décoratif */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-primary-500/10 blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />

                  <div className="flex h-full flex-col gap-4 p-4">
                    {/* Header : icône + identité + année scolaire */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="shrink-0 rounded-xl bg-gradient-to-br from-primary-400/70 to-primary-700/10 p-[2px]">
                          <div className="flex size-11 items-center justify-center rounded-[10px] border border-border/60">
                            <School className="size-5 text-primary-700 dark:text-primary-400" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary-700 dark:group-hover:text-primary-400">
                            {cls.name}
                          </h3>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GraduationCap className="size-3 shrink-0 opacity-70" />
                            <span className="truncate">
                              {levelLabel ?? "—"}
                            </span>
                            {cls.series && (
                              <>
                                <span className="text-muted-foreground/50">
                                  ·
                                </span>
                                <span className="truncate text-success font-medium">
                                  Série {cls.series}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {cls.academicYear && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium tracking-wider text-info">
                          <CalendarDays className="size-3" />
                          {cls.academicYear}
                        </span>
                      )}
                    </div>

                    {/* Stats type dashboard */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
                        <Users className="size-4 shrink-0 text-primary-700 dark:text-primary-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-none text-foreground">
                            {cls.studentsCount}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                            {studentsLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
                        <IconChalkboardTeacher className="size-4 shrink-0 text-primary-700 dark:text-primary-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-none text-foreground">
                            {cls.teachersCount}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                            {teachersLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
                        <BookOpen className="size-4 shrink-0 text-primary-700 dark:text-primary-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-none text-foreground">
                            {cls.subjectsCount}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                            {subjectsLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Prof principal */}
                    {cls.headTeacher && headName && (
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="size-6 shrink-0 border border-border/60 bg-background">
                          <AvatarFallback className="bg-primary-500/15 text-[9px] font-semibold text-primary-700 dark:text-primary-400">
                            {headInitials ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="text-muted-foreground/70">
                            {t("headTeacher")} :
                          </span>{" "}
                          <span className="font-medium text-foreground/80">
                            {headName}
                          </span>
                        </p>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="mt-auto flex items-center justify-center gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-sm font-medium text-foreground transition-colors border-primary-500/40 group-hover:bg-primary-500/10 text-primary-700 dark:text-primary-400">
                      {t("members")}
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
