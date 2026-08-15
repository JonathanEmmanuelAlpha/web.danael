"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import { InviteMemberDialog } from "@/components/schools/invite-member-dialog";
import {
  listMembersAction,
  removeMemberAction,
} from "@/server/actions/schools";
import type { SchoolMemberWithUser } from "@/server/services/schools";
import type { RoleInSchoolValue } from "@/server/db/schema/enums";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

interface MembersListProps {
  schoolId: string;
  filterRole?: RoleInSchoolValue;
  inviteRole?: RoleInSchoolValue;
  inviteLabel?: string;
  emptyTitle?: string;
  emptyHint?: string;
}

/* -- Métadonnées visuelles : rôle → icône, statut → couleurs --------- */

const ROLE_ICONS: Record<RoleInSchoolValue, LucideIcon> = {
  admin: ShieldCheck,
  teacher: GraduationCap,
  student: Users,
  parent: HeartHandshake,
  staff: Briefcase,
};

const STATUS_META: Record<
  "pending" | "active" | "revoked",
  { dot: string; badge: "success" | "warning" | "destructive" }
> = {
  active: { dot: "bg-emerald-500", badge: "success" },
  pending: { dot: "bg-amber-500", badge: "warning" },
  revoked: { dot: "bg-red-500", badge: "destructive" },
};

/**
 * §5.3 — Lists school members (teachers OR students depending on `filterRole`)
 * with invite + remove actions.
 */
export function MembersList({
  schoolId,
  filterRole,
  emptyTitle,
  emptyHint,
}: MembersListProps) {
  const t = useTranslations("Schools");
  const locale = useLocale();
  const router = useRouter();
  const [members, setMembers] = useState<SchoolMemberWithUser[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMembersAction(schoolId, filterRole).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setMembers(res.data);
      } else setMembers([]);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  async function handleRemove(userId: string, name: string) {
    setRemoving(userId);
    const res = await removeMemberAction(schoolId, userId);
    setRemoving(null);
    if (!res.success) {
      toast.error(res.error?.message ?? t("removeMember"));
      return;
    }
    toast.success(t("memberRemoved"));
    setMembers((prev) => prev?.filter((m) => m.user.id !== userId) ?? null);
    router.refresh();
  }

  function statusBadge(status: "pending" | "active" | "revoked") {
    const meta = STATUS_META[status];
    return (
      <Badge
        variant={meta.badge as never}
        size="sm"
        className="gap-1.5 rounded-full"
      >
        <span className={`size-1.5 rounded-full ${meta.dot}`} />
        {t(`memberStatus.${status}` as const)}
      </Badge>
    );
  }

  if (members === null) {
    return (
      <div className="space-y-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-4 max-w-xs">
            <div className="flex items-center gap-4">
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {members.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={emptyTitle ?? t("noMembers")}
          description={emptyHint ?? t("noMembersHint")}
        />
      ) : (
        <ul className="space-y-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((m) => {
            const name =
              [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
              m.user.email;
            const initials = name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const joinedAt = m.joinedAt ? new Date(m.joinedAt) : null;

            return (
              <li key={m.id} className="group">
                <Card className="max-w-xs relative overflow-hidden rounded-2xl border-border/60 bg-card/70 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-500/40 hover:shadow-lg hover:shadow-primary-500/10 p-0">
                  {/* Hairline dégradée au survol */}
                  <div
                    aria-hidden
                    className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />

                  <div className="flex items-center gap-4 p-4">
                    {/* Avatar + anneau dégradé + pastille de statut */}
                    <div className="relative shrink-0">
                      <div className="rounded-full bg-gradient-to-br from-primary-400/70 to-primary-700/10 p-[2px]">
                        <Avatar className="size-12 border border-border/60 bg-background">
                          {m.user.avatarUrl && (
                            <AvatarImage src={m.user.avatarUrl} alt={name} />
                          )}
                          <AvatarFallback className="bg-primary-500/15 text-sm font-semibold text-primary-700 dark:text-primary-400">
                            {initials || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card ${STATUS_META[m.status].dot} ${
                          m.status === "active" ? "animate-pulse" : ""
                        }`}
                      />
                    </div>

                    {/* Identité */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm truncate font-semibold text-foreground">
                          {name}
                        </p>
                      </div>

                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="size-3.5 shrink-0 opacity-70" />
                        <span className="truncate text-xs text-white/60">
                          {m.user.email}
                        </span>
                      </p>

                      {joinedAt && (
                        <p className="flex items-center gap-1.5 text-xs text-white/60">
                          <CalendarDays className="size-3 shrink-0 opacity-70" />
                          {new Intl.DateTimeFormat(locale, {
                            month: "long",
                            year: "numeric",
                          }).format(joinedAt)}
                        </p>
                      )}
                    </div>

                    {/* Statut + actions */}
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {statusBadge(m.status)}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 rounded-full"
                            disabled={removing === m.user.id}
                            aria-label={t("removeMember")}
                          >
                            {removing === m.user.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4 text-destructive" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("removeMember") + " "} {name}
                            </AlertDialogTitle>
                          </AlertDialogHeader>
                          <AlertDialogDescription className="leading-6 text-white/60">
                            {t("removeMemberConfirm")}
                          </AlertDialogDescription>
                          <AlertDialogFooter>
                            <div className="flex flex-row! justify-between w-full gap-6">
                              <AlertDialogCancel asChild>
                                <Button
                                  size="icon"
                                  className="flex-1"
                                  aria-label={t("removeMemberCancel")}
                                >
                                  {t("removeMemberCancel")}
                                </Button>
                              </AlertDialogCancel>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => handleRemove(m.user.id, name)}
                                disabled={removing === m.user.id}
                                aria-label={t("removeMemberValidate")}
                              >
                                {t("removeMemberValidate")}
                              </Button>
                            </div>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
