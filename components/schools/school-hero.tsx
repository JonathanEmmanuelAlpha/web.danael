"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BadgeCheck,
  BookOpen,
  Building2,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestToJoinSchoolAction } from "@/server/actions/memberships";
import { startConversationAction } from "@/server/actions/messaging";
import type { SchoolCardData } from "@/server/services/schools";

interface SchoolHeroProps {
  school: SchoolCardData;
  className?: string;
}

/**
 * §5.3 — School detail hero (Aurora Navy glassmorphism).
 *
 * Full-width `glass-strong` panel with `aurora-bg` + halos, displaying the
 * school's logo, name, verified badge, type, city/region, 4 stat tiles, 3
 * action buttons (Message us / Become a student / Become a teacher) and
 * contact info (email + phone) when available.
 */
export function SchoolHero({ school, className }: SchoolHeroProps) {
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
    toast.success(t("requestSent"), { description: t("requestSentHint") });
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
    toast.success(t("requestSent"), { description: t("requestSentHint") });
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
    <section
      className={cn(
        "glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10 animate-fade-up",
        className,
      )}
    >
      {/* Aurora background + halos */}
      <div
        aria-hidden
        className="aurora-bg pointer-events-none absolute inset-0 opacity-50"
      />
      <div
        aria-hidden
        className="halo-lime pointer-events-none absolute -top-24 -right-12 size-72 opacity-70"
      />
      <div
        aria-hidden
        className="halo-violet pointer-events-none absolute -bottom-24 -left-12 size-72 opacity-60"
      />

      <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: identity */}
        <div className="flex flex-col gap-5 lg:max-w-2xl">
          <div className="flex items-start gap-5">
            <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-primary-500/10 text-primary-300 ring-2 ring-primary-500/30 glow-primary-sm">
              {school.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={school.logoUrl}
                  alt={school.name}
                  className="size-full object-cover"
                />
              ) : (
                <span className="font-display text-2xl font-bold tracking-tight text-primary-200">
                  {initials}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl"
                  title={school.name}
                >
                  {school.name}
                </h1>
                {school.isVerified && (
                  <Badge variant="success" size="lg" className="gap-1">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    {t("verified")}
                  </Badge>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {typeLabel && (
                  <Badge variant="secondary" size="sm">
                    {typeLabel}
                  </Badge>
                )}
                {school.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {school.city}
                    {school.region ? `, ${school.region}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats tiles (4 in a row) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStatTile
              icon={Users}
              label={t("members")}
              value={school.membersCount}
              tone="primary"
            />
            <HeroStatTile
              icon={Building2}
              label={t("classes")}
              value={school.classesCount}
              tone="cyan"
            />
            <HeroStatTile
              icon={BookOpen}
              label={t("teachers")}
              value={school.teachersCount}
              tone="violet"
            />
            <HeroStatTile
              icon={GraduationCap}
              label={t("students")}
              value={school.studentsCount}
              tone="amber"
            />
          </div>

          {/* Contact info */}
          {(school.contactEmail || school.contactPhone) && (
            <div className="rounded-2xl border border-border bg-surface-2/60 p-4 backdrop-blur-md">
              <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                <MessageSquare className="size-4 text-primary-300" aria-hidden />
                {t("contactInfo")}
              </h3>
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:gap-6">
                {school.contactEmail && (
                  <a
                    href={`mailto:${school.contactEmail}`}
                    className="inline-flex items-center gap-2 hover:text-primary-300"
                  >
                    <Mail className="size-3.5" aria-hidden />
                    {school.contactEmail}
                  </a>
                )}
                {school.contactPhone && (
                  <a
                    href={`tel:${school.contactPhone}`}
                    className="inline-flex items-center gap-2 hover:text-primary-300"
                  >
                    <Phone className="size-3.5" aria-hidden />
                    {school.contactPhone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[260px]">
          <Button
            type="button"
            variant="brand"
            size="lg"
            onClick={handleMessage}
            disabled={pendingMessage}
            className="w-full justify-center"
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
            size="lg"
            onClick={handleBecomeStudent}
            disabled={pendingStudent}
            className="w-full justify-center"
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
            size="lg"
            onClick={handleBecomeTeacher}
            disabled={pendingTeacher}
            className="w-full justify-center"
          >
            {pendingTeacher ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BookOpen className="size-4" />
            )}
            {t("becomeTeacher")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ── Hero stat tile ────────────────────────────────────────────── */

interface HeroStatTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "primary" | "cyan" | "violet" | "amber";
}

const heroToneClasses: Record<HeroStatTileProps["tone"], string> = {
  primary: "text-primary-300 bg-primary-500/10 ring-primary-500/20",
  cyan: "text-accent-cyan-400 bg-accent-cyan-500/10 ring-accent-cyan-500/20",
  violet:
    "text-accent-violet-400 bg-accent-violet-500/10 ring-accent-violet-500/20",
  amber:
    "text-accent-amber-400 bg-accent-amber-500/10 ring-accent-amber-500/20",
};

function HeroStatTile({ icon: Icon, label, value, tone }: HeroStatTileProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-2/60 p-3 backdrop-blur-md">
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-lg ring-1",
          heroToneClasses[tone],
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <span className="font-display text-2xl font-bold text-foreground">
        {value.toLocaleString()}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
