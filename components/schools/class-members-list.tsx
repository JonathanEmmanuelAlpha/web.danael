"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarDays,
  CircleUser,
  GraduationCap,
  Loader2,
  Mail,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import {
  listMembersAction,
  removeMemberAction,
} from "@/server/actions/classes";
import type { ClassMemberWithUser } from "@/server/services/classes";
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

interface ClassMembersListProps {
  classId: string;
  canManage: boolean;
}

/**
 * §5.3 — Lists teachers + students of a class, with optional remove action.
 */
export function ClassMembersList({
  classId,
  canManage,
}: ClassMembersListProps) {
  const t = useTranslations("Classes");
  const router = useRouter();
  const [members, setMembers] = useState<ClassMemberWithUser[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMembersAction(classId).then((res) => {
      if (cancelled) return;
      if (res.success) setMembers(res.data);
      else setMembers([]);
    });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`${t("removeMember")} — ${name}?`)) return;
    setRemoving(userId);
    const res = await removeMemberAction(classId, userId);
    setRemoving(null);
    if (!res.success) {
      toast.error(res.error?.message ?? t("removeMember"));
      return;
    }
    toast.success(t("removeMember"));
    setMembers((prev) => prev?.filter((m) => m.user.id !== userId) ?? null);
    router.refresh();
  }

  if (members === null) {
    return (
      <Card className="p-5">
        <Skeleton className="h-6 w-1/3" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    );
  }

  const teachers = members.filter((m) => m.role === "teacher");
  const students = members.filter((m) => m.role === "student");
  const others = members.filter(
    (m) => m.role !== "teacher" && m.role !== "student",
  );

  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("noMembers")}
        description={t("noMembersHint")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <MemberGroup
        title={t("teachers")}
        icon={<GraduationCap className="size-4" />}
        members={teachers}
        canManage={canManage}
        onRemove={handleRemove}
        removingId={removing}
        variant="info"
      />
      <MemberGroup
        title={t("students")}
        icon={<CircleUser className="size-4" />}
        members={students}
        canManage={canManage}
        onRemove={handleRemove}
        removingId={removing}
        variant="brand"
      />
      {others.length > 0 && (
        <MemberGroup
          title={t("members")}
          icon={<Users className="size-4" />}
          members={others}
          canManage={canManage}
          onRemove={handleRemove}
          removingId={removing}
          variant="secondary"
        />
      )}
    </div>
  );
}

interface MemberGroupProps {
  title: string;
  icon: React.ReactNode;
  members: ClassMemberWithUser[];
  canManage: boolean;
  onRemove: (userId: string, name: string) => void;
  removingId: string | null;
  variant: "info" | "brand" | "secondary";
}

function MemberGroup({
  title,
  icon,
  members,
  canManage,
  onRemove,
  removingId,
  variant,
}: MemberGroupProps) {
  const locale = useLocale();
  const t = useTranslations("Classes");

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant={variant} size="sm">
          {members.length}
        </Badge>
      </div>
      {members.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">—</p>
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 rounded-full"
                            disabled={removingId === m.user.id}
                            aria-label={t("removeMember")}
                          >
                            {removingId === m.user.id ? (
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
                                onClick={() => onRemove(m.user.id, name)}
                                disabled={removingId === m.user.id}
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
