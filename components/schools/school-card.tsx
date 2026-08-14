"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  requestToJoinSchoolAction,
} from "@/server/actions/memberships";
import {
  startConversationAction,
} from "@/server/actions/messaging";
import type { SchoolCardData } from "@/server/services/schools";

interface SchoolCardProps {
  school: SchoolCardData;
  className?: string;
  /** When true, hides the "Explore" CTA (used on the detail hero). */
  hideExploreCta?: boolean;
}

/**
 * §5.3 — Public school card (Aurora Navy glassmorphism).
 *
 * Vertical glass-card layout with logo, name, verified badge, type/city,
 * a 4-tile stats grid (members / classes / teachers / students) and 4
 * actions: Message us / Become a student / Become a teacher / Explore.
 *
 * Mount animation: `animate-fade-up`. Hover: `-translate-y-1 + glow-primary-sm`.
 */
export function SchoolCard({
  school,
  className,
  hideExploreCta,
}: SchoolCardProps) {
  const t = useTranslations("Schools");
  const router = useRouter();

  const [pendingStudent, setPendingStudent] = React.useState(false);
  const [pendingTeacher, setPendingTeacher] = React.useState(false);
  const [pendingMessage, setPendingMessage] = React.useState(false);

  const initials = React.useMemo(() => {
    const parts = school.name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
  }, [school.name]);

  const typeLabel = school.type
    ? t(`types.${school.type}` as const)
    : null;

  async function handleBecomeStudent() {
    setPendingStudent(true);
    const result = await requestToJoinSchoolAction({
      schoolId: school.id,
      roleInSchool: "student",
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
    const result = await requestToJoinSchoolAction({
      schoolId: school.id,
      roleInSchool: "teacher",
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

  async function handleMessage() {
    if (!school.contactUserId) {
      toast.error(t("noContactAvailable"));
      return;
    }
    setPendingMessage(true);
    const result = await startConversationAction({
      participantId: school.contactUserId,
    });
    setPendingMessage(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("noContactAvailable"));
      return;
    }
    if (!result.data) {
      toast.error(t("noContactAvailable"));
      return;
    }
    toast.success(t("conversationStarted"));
    router.push(`/messages/${result.data.threadId}`);
  }

  return (
    <article
      className={cn(
        "glass-card group relative flex h-full flex-col gap-5 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:glow-primary-sm animate-fade-up",
        className,
      )}
    >
      {/* ── Top: logo + name + badges ─────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-500/10 text-primary-300 ring-1 ring-primary-500/30">
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logoUrl}
              alt={school.name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="font-display text-lg font-semibold tracking-tight text-primary-200">
              {initials}
            </span>
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/10 to-transparent"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="font-display text-xl font-semibold leading-tight text-foreground"
              title={school.name}
            >
              {school.name}
            </h3>
            {school.isVerified && (
              <Badge variant="success" size="sm" className="gap-1">
                <BadgeCheck className="size-3" aria-hidden />
                {t("verified")}
              </Badge>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {typeLabel && (
              <Badge variant="secondary" size="sm">
                {typeLabel}
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
        </div>
      </div>

      {/* ── Stats grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={Users}
          label={t("members")}
          value={school.membersCount}
          tone="primary"
        />
        <StatTile
          icon={Building2}
          label={t("classes")}
          value={school.classesCount}
          tone="cyan"
        />
        <StatTile
          icon={BookOpen}
          label={t("teachers")}
          value={school.teachersCount}
          tone="violet"
        />
        <StatTile
          icon={GraduationCap}
          label={t("students")}
          value={school.studentsCount}
          tone="amber"
        />
      </div>

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={handleMessage}
          disabled={pendingMessage}
          className="flex-1 min-w-[140px]"
        >
          {pendingMessage ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          {t("messageUs")}
        </Button>
        <Button
          type="button"
          variant="brand-outline"
          size="sm"
          onClick={handleBecomeStudent}
          disabled={pendingStudent}
          className="flex-1 min-w-[140px]"
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
          className="flex-1 min-w-[140px]"
        >
          {pendingTeacher ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BookOpen className="size-4" />
          )}
          {t("becomeTeacher")}
        </Button>
        {!hideExploreCta && (
          <Button
            asChild
            variant="brand"
            size="sm"
            className="flex-1 min-w-[140px]"
          >
            <Link href={`/schools/${school.id}`}>
              {t("explore")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────── */

interface StatTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "primary" | "cyan" | "violet" | "amber";
}

const toneClasses: Record<StatTileProps["tone"], string> = {
  primary: "text-primary-300 bg-primary-500/10 ring-primary-500/20",
  cyan: "text-accent-cyan-400 bg-accent-cyan-500/10 ring-accent-cyan-500/20",
  violet:
    "text-accent-violet-400 bg-accent-violet-500/10 ring-accent-violet-500/20",
  amber:
    "text-accent-amber-400 bg-accent-amber-500/10 ring-accent-amber-500/20",
};

function StatTile({ icon: Icon, label, value, tone }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-2/60 p-3">
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded-lg ring-1",
          toneClasses[tone],
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </div>
      <span className="font-display text-lg font-semibold text-foreground">
        {value.toLocaleString()}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
