"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  MapPin,
  School as SchoolIcon,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

/**
 * School type — kept as a literal union (mirrors the `schoolTypeEnum`
 * from `@/server/db/schema/enums`). Declared locally so the explorer
 * stays decoupled from the DB layer.
 */
export type MySchoolType = "public" | "private" | "parochial" | "other";

export interface MySchoolSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  region: string | null;
  type: MySchoolType | null;
}

export interface MyClassSummary {
  id: string;
  name: string;
  level: string | null;
  series: string | null;
  academicYear: string | null;
  headTeacherName?: string | null;
}

interface MySchoolExplorerProps {
  schools: MySchoolSummary[];
  classesBySchool: Record<string, MyClassSummary[]>;
}

/**
 * §5.3 — "My School" explorer (student + teacher dashboards).
 *
 * Two-column responsive layout:
 *  - Left: vertical list of school cards the user belongs to.
 *    Clicking one selects it (client-side state, no router navigation).
 *  - Right: classes the user is enrolled in / teaches in the selected
 *    school. Each class card links to `/classes/{id}`.
 *
 * Uses shadcn `Card`, `Button`, `Badge` and the Aurora Navy glass
 * aesthetic already in place across the app.
 */
export function MySchoolExplorer({
  schools,
  classesBySchool,
}: MySchoolExplorerProps) {
  const t = useTranslations("Navigation");
  const tSchools = useTranslations("Schools");
  const tClasses = useTranslations("Classes");

  const [selectedSchoolId, setSelectedSchoolId] = React.useState<string | null>(
    schools[0]?.id ?? null,
  );

  // Reset the selection when the `schools` prop changes and the current
  // selection is no longer valid. Uses the "previous render" pattern
  // described in the React docs to avoid a cascading setState in an effect.
  const [prevSchools, setPrevSchools] = React.useState(schools);
  if (schools !== prevSchools) {
    setPrevSchools(schools);
    if (!selectedSchoolId || !schools.some((s) => s.id === selectedSchoolId)) {
      setSelectedSchoolId(schools[0]?.id ?? null);
    }
  }

  if (schools.length === 0) {
    return (
      <EmptyState
        icon={SchoolIcon}
        title={t("mySchoolEmpty")}
        description={t("mySchoolEmptyHint")}
        action={{ label: t("schools"), href: "/schools" }}
      />
    );
  }

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId) ?? null;
  const selectedClasses: MyClassSummary[] = selectedSchool
    ? classesBySchool[selectedSchool.id] ?? []
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* ── Left column — school list ─────────────────────────── */}
      <nav aria-label={t("mySchoolTitle")} className="space-y-3">
        <ul className="space-y-3">
          {schools.map((school) => {
            const count = classesBySchool[school.id]?.length ?? 0;
            const isActive = school.id === selectedSchoolId;
            return (
              <li key={school.id}>
                <button
                  type="button"
                  onClick={() => setSelectedSchoolId(school.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "glass-card group w-full rounded-xl border p-4 text-left transition-all duration-200",
                    isActive
                      ? "border-primary-500/50 ring-1 ring-primary-500/40 glow-primary-sm"
                      : "border-border hover:border-border-strong hover:-translate-y-0.5",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300 ring-1 ring-primary-500/20">
                      <SchoolIcon className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate font-display text-base font-semibold text-foreground"
                        title={school.name}
                      >
                        {school.name}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {school.type && (
                          <Badge variant="secondary" size="sm">
                            {tSchools(`types.${school.type}` as const)}
                          </Badge>
                        )}
                        {school.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" aria-hidden />
                            {school.city}
                            {school.region ? `, ${school.region}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="size-3" aria-hidden />
                        {t("mySchoolClassesCount", { count })}
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isActive && "translate-x-0.5 text-primary-300",
                      )}
                      aria-hidden
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Right column — classes of the selected school ─────── */}
      <div className="space-y-4">
        {selectedSchool ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {t("mySchoolClasses")}
                </h2>
                <p
                  className="mt-1 truncate text-sm text-muted-foreground"
                  title={selectedSchool.name}
                >
                  {selectedSchool.name}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={`/schools/${selectedSchool.id}`}>
                  <SchoolIcon className="size-4" />
                  {t("schools")}
                </Link>
              </Button>
            </div>

            {selectedClasses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={t("mySchoolNoClasses")}
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {selectedClasses.map((cls) => {
                  const levelLabel = cls.level
                    ? tClasses(`levelLabels.${cls.level}` as const)
                    : null;
                  return (
                    <li key={cls.id}>
                      <Link
                        href={`/classes/${cls.id}`}
                        className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-glass"
                      >
                        <Card className="h-full gap-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h3
                                className="truncate font-display text-base font-semibold text-foreground transition-colors group-hover:text-primary-300"
                                title={cls.name}
                              >
                                {cls.name}
                              </h3>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {levelLabel && (
                                  <Badge variant="brand" size="sm">
                                    {levelLabel}
                                  </Badge>
                                )}
                                {cls.series && (
                                  <Badge variant="violet" size="sm">
                                    {tClasses("series")} {cls.series}
                                  </Badge>
                                )}
                                {cls.academicYear && (
                                  <Badge variant="secondary" size="sm">
                                    <CalendarDays className="size-3" aria-hidden />
                                    {cls.academicYear}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300 ring-1 ring-primary-500/20">
                              <GraduationCap className="size-4" aria-hidden />
                            </div>
                          </div>
                          {cls.headTeacherName && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Users className="size-3 shrink-0" aria-hidden />
                              <span className="truncate">
                                {cls.headTeacherName}
                              </span>
                            </div>
                          )}
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <EmptyState icon={SchoolIcon} title={t("mySchoolSelectHint")} />
        )}
      </div>
    </div>
  );
}
