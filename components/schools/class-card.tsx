"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookOpen, GraduationCap, Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestToJoinClassAction } from "@/server/actions/memberships";
import type { ClassCardData } from "@/server/services/schools";

interface ClassCardProps {
  cls: ClassCardData;
  className?: string;
}

/**
 * §5.3 — Public class card (compact Aurora Navy glassmorphism).
 *
 * Shows class name, level + series badges, academic year, 3 stat tiles
 * (members / students / teachers) and 2 actions: Become a student /
 * Become a teacher (both call `requestToJoinClassAction`).
 */
export function ClassCard({ cls, className }: ClassCardProps) {
  const t = useTranslations("Schools");
  const tClasses = useTranslations("Classes");

  const [pendingStudent, setPendingStudent] = React.useState(false);
  const [pendingTeacher, setPendingTeacher] = React.useState(false);

  const levelLabel = cls.level
    ? tClasses(`levelLabels.${cls.level}` as const)
    : null;

  async function handleBecomeStudent() {
    setPendingStudent(true);
    const result = await requestToJoinClassAction({
      classId: cls.id,
      role: "student",
    });
    setPendingStudent(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("requestSent"));
      return;
    }
    toast.success(t("requestSent"), {
      description: t("requestSentHint"),
    });
  }

  async function handleBecomeTeacher() {
    setPendingTeacher(true);
    const result = await requestToJoinClassAction({
      classId: cls.id,
      role: "teacher",
    });
    setPendingTeacher(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("requestSent"));
      return;
    }
    toast.success(t("requestSent"), {
      description: t("requestSentHint"),
    });
  }

  return (
    <article
      className={cn(
        "glass-card group relative flex h-full flex-col gap-4 rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 hover:glow-primary-sm animate-fade-up",
        className,
      )}
    >
      {/* Top: name + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-display text-base font-semibold text-foreground"
            title={cls.name}
          >
            {cls.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {cls.schoolName}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-300 ring-1 ring-primary-500/20">
          <BookOpen className="size-5" aria-hidden />
        </div>
      </div>

      {/* Badges: level + series + academic year */}
      <div className="flex flex-wrap items-center gap-2">
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
            {cls.academicYear}
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <CompactStat
          icon={Users}
          value={cls.membersCount}
          label={t("members")}
        />
        <CompactStat
          icon={GraduationCap}
          value={cls.studentsCount}
          label={t("students")}
        />
        <CompactStat
          icon={BookOpen}
          value={cls.teachersCount}
          label={t("teachers")}
        />
      </div>

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-2">
        <Button
          type="button"
          variant="brand-outline"
          size="sm"
          onClick={handleBecomeStudent}
          disabled={pendingStudent}
          className="flex-1"
        >
          {pendingStudent ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GraduationCap className="size-4" />
          )}
          {t("becomeStudent")}
        </Button>
        <Button
          type="button"
          variant="brand-outline"
          size="sm"
          onClick={handleBecomeTeacher}
          disabled={pendingTeacher}
          className="flex-1"
        >
          {pendingTeacher ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BookOpen className="size-4" />
          )}
          {t("becomeTeacher")}
        </Button>
      </div>
    </article>
  );
}

/* -- Compact stat ------------------------------------------------ */

interface CompactStatProps {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}

function CompactStat({ icon: Icon, value, label }: CompactStatProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface-2/60 p-2 text-center">
      <Icon className="mx-auto size-3.5 text-muted-foreground" aria-hidden />
      <span className="font-display text-sm font-semibold text-foreground">
        {value.toLocaleString()}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
