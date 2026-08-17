"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { GraduationCap, Loader2, UserCog } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/shared/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { listMembersAction } from "@/server/actions/classes";
import { updateClassAction } from "@/server/actions/classes";
import type { ClassMemberWithUser } from "@/server/services/classes";

interface HeadTeacherAssignerProps {
  classId: string;
  currentHeadTeacherId?: string | null;
  currentHeadTeacherName?: string | null;
  canManage: boolean;
}

/**
 * Head teacher assignment widget for the class detail page.
 *
 * Shows the current head teacher (professeur principal) and lets the
 * school_admin / platform_admin assign a new one from the list of teachers
 * who are members of the class.
 *
 * If no teachers are members of the class yet, the assigner shows a hint to
 * first invite teachers to the class.
 */
export function HeadTeacherAssigner({
  classId,
  currentHeadTeacherId,
  currentHeadTeacherName,
  canManage,
}: HeadTeacherAssignerProps) {
  const t = useTranslations("Classes");
  const router = useRouter();
  const [members, setMembers] = useState<ClassMemberWithUser[] | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(currentHeadTeacherId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    listMembersAction(classId).then((res) => {
      if (cancelled) return;
      setMembers(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [classId, canManage]);

  // Filter only teachers
  const teachers = (members ?? []).filter((m) => m.role === "teacher");

  async function handleAssign() {
    if (!selected) return;
    setSaving(true);
    const res = await updateClassAction({
      id: classId,
      headTeacherId: selected || null,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("headTeacherAssignFailed"));
      return;
    }
    toast.success(t("headTeacherAssigned"));
    setOpen(false);
    router.refresh();
  }

  async function handleUnassign() {
    setSaving(true);
    const res = await updateClassAction({
      id: classId,
      headTeacherId: null,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("headTeacherAssignFailed"));
      return;
    }
    toast.success(t("headTeacherUnassigned"));
    router.refresh();
  }

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400">
        <GraduationCap className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("headTeacher")}
        </p>
        {currentHeadTeacherName ? (
          <p className="font-medium text-foreground">
            {currentHeadTeacherName}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {t("headTeacherNone")}
          </p>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          {currentHeadTeacherId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnassign}
              disabled={saving}
              className="text-accent-coral-400 hover:bg-accent-coral-500/10 hover:text-accent-coral-300"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserCog className="size-4" />
              )}
              {t("headTeacherUnassign")}
            </Button>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserCog className="size-4" />
                {currentHeadTeacherId
                  ? t("headTeacherChange")
                  : t("headTeacherAssign")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("headTeacherAssignTitle")}</DialogTitle>
                <DialogDescription>
                  {t("headTeacherAssignDescription")}
                </DialogDescription>
              </DialogHeader>

              {members === null ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("headTeacherNoTeachers")}
                </p>
              ) : (
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t("headTeacherSelectPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => {
                      const name =
                        [teacher.user.firstName, teacher.user.lastName]
                          .filter(Boolean)
                          .join(" ") || teacher.user.email;
                      return (
                        <SelectItem
                          key={teacher.user.id}
                          value={teacher.user.id}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6">
                              {teacher.user.avatarUrl && (
                                <AvatarImage src={teacher.user.avatarUrl} />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="brand"
                  onClick={handleAssign}
                  disabled={saving || !selected || teachers.length === 0}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("headTeacherAssign")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </Card>
  );
}
