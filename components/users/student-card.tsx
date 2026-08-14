"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Award,
  CheckCircle2,
  Flame,
  Loader2,
  Mail,
  Star,
  TrendingUp,
  Trophy,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createInvitationAction } from "@/server/actions/memberships";
import { startConversationAction } from "@/server/actions/messaging";
import type { StudentCardData } from "@/server/actions/users";

interface StudentCardProps {
  student: StudentCardData;
  /** School id the school_admin is acting on behalf of. */
  schoolId: string;
  className?: string;
}

function initials(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim().charAt(0).toUpperCase();
  const l = (last ?? "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "?";
}

/**
 * Glass-card for a student in the "Find Students" listing.
 *
 * Highlights "strong points" (streak, XP, badges, quizzes, avg score) so
 * school admins are encouraged to invite the most active learners.
 * When `avgScore > 80` an amber "Top performer" badge glows on the card.
 */
export function StudentCard({ student, schoolId, className }: StudentCardProps) {
  const t = useTranslations("Users");
  const router = useRouter();
  const [inviting, setInviting] = React.useState(false);
  const [messaging, setMessaging] = React.useState(false);

  const name =
    [student.firstName, student.lastName].filter(Boolean).join(" ") || "Élève";

  const isTopPerformer =
    student.avgScore !== null && student.avgScore > 80;

  async function handleInvite() {
    setInviting(true);
    const res = await createInvitationAction({
      targetType: "school",
      targetId: schoolId,
      inviteeUserId: student.id,
      roleInTarget: "student",
    });
    setInviting(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("inviteAsStudent"));
      return;
    }
    toast.success(t("invitationSent"));
    router.refresh();
  }

  async function handleMessage() {
    setMessaging(true);
    const res = await startConversationAction({ participantId: student.id });
    setMessaging(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("messageMe"));
      return;
    }
    router.push(`/messages/${res.data.threadId}`);
  }

  return (
    <Card
      className={cn(
        "group glass-card relative flex h-full flex-col gap-4 rounded-2xl p-5",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-border-strong",
        isTopPerformer
          ? "glow-amber"
          : "hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.3)]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="size-12 border border-border">
          {student.avatarUrl ? (
            <AvatarImage src={student.avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback className="bg-accent-cyan-500/10 font-semibold text-accent-cyan-300">
            {initials(student.firstName, student.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-foreground">
              {name}
            </h3>
            {isTopPerformer && (
              <Badge variant="warning" size="sm">
                <Trophy className="size-3" />
                {t("topPerformer")}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {student.email}
          </p>
          {(student.level || student.series) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {student.level && (
                <Badge variant="info" size="sm">
                  {student.level}
                </Badge>
              )}
              {student.series && (
                <Badge variant="violet" size="sm">
                  Série {student.series}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats grid (strong points) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          icon={<Flame className="size-3.5" />}
          label={t("streak")}
          value={student.currentStreak}
          tone="coral"
        />
        <Stat
          icon={<Star className="size-3.5" />}
          label={t("xp")}
          value={student.xpPoints}
          tone="amber"
        />
        <Stat
          icon={<Award className="size-3.5" />}
          label={t("badges")}
          value={student.badgesCount}
          tone="violet"
        />
        <Stat
          icon={<CheckCircle2 className="size-3.5" />}
          label={t("quizzes")}
          value={student.quizzesCompleted}
          tone="primary"
        />
        <Stat
          icon={<TrendingUp className="size-3.5" />}
          label={t("avgScore")}
          value={
            student.avgScore !== null ? `${student.avgScore}%` : "—"
          }
          tone="cyan"
        />
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <Button
          type="button"
          variant="brand"
          size="sm"
          onClick={handleInvite}
          disabled={inviting || messaging}
          className="flex-1"
        >
          {inviting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          {t("inviteAsStudent")}
        </Button>
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={handleMessage}
          disabled={inviting || messaging}
          className="flex-1"
        >
          {messaging ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          {t("messageMe")}
        </Button>
      </div>
    </Card>
  );
}

/* ── Internal stat tile ─────────────────────────────────────── */

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: "primary" | "cyan" | "amber" | "violet" | "coral";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary-300"
      : tone === "cyan"
        ? "text-accent-cyan-300"
        : tone === "amber"
          ? "text-accent-amber-300"
          : tone === "violet"
            ? "text-accent-violet-300"
            : "text-accent-coral-300";
  return (
    <div className="glass flex flex-col items-center gap-1 rounded-lg p-2.5 text-center">
      <div className={cn("flex items-center gap-1 text-[10px] uppercase tracking-wide", toneClass)}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-display text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}
