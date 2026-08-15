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
  CheckCircle2,
  BookOpen,
  FolderOpen,
  Star,
  Mail,
  UserPlus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createInvitationAction } from "@/server/actions/memberships";
import { startConversationAction } from "@/server/actions/messaging";
import type { TeacherCardData } from "@/server/actions/users";

interface TeacherCardProps {
  teacher: TeacherCardData;
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
 * Glass-card for a teacher in the "Find Teachers" listing.
 *
 * Aurora Navy styling — glass-card with hover lift, primary glow on the
 * invite CTA. Two actions:
 *  - Invite as teacher  → createInvitationAction({ target: school, role: teacher })
 *  - Message Me         → startConversationAction({ participantId })
 */
export function TeacherCard({
  teacher,
  schoolId,
  className,
}: TeacherCardProps) {
  const t = useTranslations("Users");
  const router = useRouter();
  const [inviting, setInviting] = React.useState(false);
  const [messaging, setMessaging] = React.useState(false);

  const name =
    [teacher.firstName, teacher.lastName].filter(Boolean).join(" ") ||
    "Enseignant";

  async function handleInvite() {
    setInviting(true);
    const res = await createInvitationAction({
      targetType: "school",
      targetId: schoolId,
      inviteeUserId: teacher.id,
      roleInTarget: "teacher",
    });
    setInviting(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("inviteAsTeacher"));
      return;
    }
    toast.success(t("invitationSent"));
    router.refresh();
  }

  async function handleMessage() {
    setMessaging(true);
    const res = await startConversationAction({ participantId: teacher.id });
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
        "hover:shadow-[0_0_28px_-6px_rgba(147,217,26,0.35)]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="size-12 border border-border">
          {teacher.avatarUrl ? (
            <AvatarImage src={teacher.avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback className="bg-primary-500/10 font-semibold text-primary-300">
            {initials(teacher.firstName, teacher.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-foreground">
              {name}
            </h3>
            {teacher.isVerified && (
              <Badge variant="success" size="sm">
                <CheckCircle2 className="size-3" />
                {t("verifiedOnly")}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {teacher.email}
          </p>
        </div>
      </div>

      {/* Subjects */}
      {teacher.subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {teacher.subjects.slice(0, 4).map((s) => (
            <Badge key={s} variant="brand" size="sm">
              {s}
            </Badge>
          ))}
          {teacher.subjects.length > 4 && (
            <Badge variant="secondary" size="sm">
              +{teacher.subjects.length - 4}
            </Badge>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={<BookOpen className="size-3.5" />}
          label={t("classes")}
          value={teacher.classesCount}
          tone="primary"
        />
        <Stat
          icon={<FolderOpen className="size-3.5" />}
          label={t("contents")}
          value={teacher.contentsCount}
          tone="cyan"
        />
        <Stat
          icon={<Star className="size-3.5" />}
          label={t("rating")}
          value={teacher.rating !== null ? teacher.rating.toFixed(1) : "—"}
          tone="amber"
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
          {t("inviteAsTeacher")}
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

/* -- Internal stat tile --------------------------------------- */

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: "primary" | "cyan" | "amber";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary-300"
      : tone === "cyan"
        ? "text-accent-cyan-300"
        : "text-accent-amber-300";
  return (
    <div className="glass flex flex-col items-center gap-1 rounded-lg p-2.5 text-center">
      <div
        className={cn(
          "flex items-center gap-1 text-[10px] uppercase tracking-wide",
          toneClass,
        )}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-display text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}
