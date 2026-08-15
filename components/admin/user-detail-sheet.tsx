"use client";

/**
 * §5.16 — User detail slide-over panel.
 *
 * Fetches user details (school memberships + subscription status) via
 * `getUserByIdAction` when a user row is clicked.
 *
 * Role management: dropdown to change role + deactivate button. Both call
 * the corresponding server action and emit a toast on success.
 *
 * The role-change subform uses TanStack Form + Zod (Standard Schema) with
 * the shared `SelectField` / `SubmitButton` wrappers.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Mail,
  UserCircle,
  School as SchoolIcon,
  CreditCard,
  ShieldAlert,
  Loader2,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SelectField, SubmitButton } from "@/components/forms/tanstack-fields";

import {
  getUserByIdAction,
  updateUserRoleAction,
  deactivateUserAction,
} from "@/server/actions/admin";
import type { AdminUserDetail } from "@/server/services/admin";
import { USER_ROLES, type UserRole } from "@/types";
import { roleBadgeVariant } from "@/lib/role-utils";

export interface UserDetailSheetProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleFormSchema = z.object({
  role: z.enum([
    "student",
    "teacher",
    "school_admin",
    "parent",
    "tutor",
    "platform_admin",
    "content_moderator",
    "support",
  ]),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

export function UserDetailSheet({
  userId,
  open,
  onOpenChange,
}: UserDetailSheetProps) {
  const t = useTranslations("Admin");
  const tRoles = useTranslations("Roles");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const roleForm = useForm({
    defaultValues: { role: "support" as UserRole } as RoleFormValues,
    validators: { onChange: roleFormSchema },
    onSubmit: async ({ value }) => {
      if (!detail || value.role === detail.role) return;
      const res = await updateUserRoleAction({
        userId: detail.id,
        role: value.role as AdminUserDetail["role"],
      });
      if (res.success) {
        toast.success(t("roleChanged"));
        setDetail({
          ...detail,
          role: res.data.role as AdminUserDetail["role"],
        });
      } else {
        toast.error(res.error?.message ?? t("changeRoleFailed"));
        roleForm.reset({ role: detail.role });
      }
    },
  });

  // Hydrate the role form whenever a new user detail is loaded.
  useEffect(() => {
    if (detail) {
      roleForm.reset({ role: detail.role });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  useEffect(() => {
    if (!userId || !open) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    getUserByIdAction({ id: userId })
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setDetail(res.data);
        } else {
          toast.error(res.error?.message ?? t("loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, open, t]);

  async function handleDeactivate() {
    if (!detail) return;
    setDeactivating(true);
    try {
      const res = await deactivateUserAction({ userId: detail.id });
      if (res.success) {
        toast.success(t("deactivated"));
        setDetail({ ...detail, role: "support" });
        roleForm.reset({ role: "support" });
        onOpenChange(false);
      } else {
        toast.error(res.error?.message ?? t("deactivateFailed"));
      }
    } finally {
      setDeactivating(false);
    }
  }

  const initials = detail
    ? (detail.firstName?.[0] ?? "") + (detail.lastName?.[0] ?? "")
    : "";
  const fullName = detail
    ? [detail.firstName, detail.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("userDetail")}</SheetTitle>
          <SheetDescription>{t("userDetailHint")}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-5 px-4 pb-8">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                {detail.avatarUrl && (
                  <AvatarImage src={detail.avatarUrl} alt={fullName} />
                )}
                <AvatarFallback>{initials || "?"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-display text-base font-semibold text-foreground">
                  {fullName || t("noName")}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="size-3" /> {detail.email}
                </p>
              </div>
            </div>

            {/* Role */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <UserCircle className="size-3.5" /> {t("role")}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Badge variant={roleBadgeVariant(detail.role)}>
                  {tRoles(detail.role)}
                </Badge>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void roleForm.handleSubmit();
                  }}
                  className="flex flex-1 items-center gap-2"
                >
                  <roleForm.Field name="role">
                    {(field) => (
                      <SelectField
                        field={field}
                        className="flex-1"
                        aria-label={t("changeRole")}
                        options={USER_ROLES.map((r) => ({
                          value: r,
                          label: tRoles(r),
                        }))}
                      />
                    )}
                  </roleForm.Field>
                  <roleForm.Subscribe
                    selector={(state) =>
                      [
                        state.isSubmitting,
                        state.values.role === detail.role,
                      ] as const
                    }
                  >
                    {([isSubmitting, isUnchanged]) => (
                      <SubmitButton
                        pending={isSubmitting}
                        disabled={isUnchanged}
                        size="sm"
                      >
                        {t("save")}
                      </SubmitButton>
                    )}
                  </roleForm.Subscribe>
                </form>
              </div>
            </div>

            {/* Subscription */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <CreditCard className="size-3.5" /> {t("subscription")}
              </div>
              {detail.subscription ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {t(`plans.${detail.subscription.planType}` as never)}
                  </span>
                  <Badge
                    variant={
                      detail.subscription.status === "active"
                        ? "success"
                        : "secondary"
                    }
                  >
                    {t(
                      `subscriptionStatus.${detail.subscription.status}` as never,
                    )}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("noSubscription")}
                </p>
              )}
            </div>

            {/* Schools */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <SchoolIcon className="size-3.5" /> {t("schools")}
              </div>
              {detail.schools.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noSchools")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.schools.map((s) => (
                    <li
                      key={s.schoolId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">{s.schoolName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" size="sm">
                          {t(`roleInSchool.${s.roleInSchool}` as never)}
                        </Badge>
                        <Badge
                          variant={
                            s.status === "active" ? "success" : "secondary"
                          }
                          size="sm"
                        >
                          {t(`memberStatus.${s.status}` as never)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Metadata */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t("onboarding")}</span>
                <Badge
                  variant={
                    detail.onboardingStatus === "completed"
                      ? "success"
                      : "warning"
                  }
                  size="sm"
                >
                  {detail.onboardingStatus === "completed"
                    ? t("completed")
                    : t("pending")}
                </Badge>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t("streak")}</span>
                <span className="font-medium">
                  {detail.currentStreak} {t("days")}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t("joinedAt")}</span>
                <span className="font-medium">
                  {new Date(detail.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
              {detail.lastActiveAt && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t("lastActive")}
                  </span>
                  <span className="font-medium">
                    {new Date(detail.lastActiveAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              )}
            </div>

            {/* Danger zone */}
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-destructive">
                <ShieldAlert className="size-3.5" /> {t("dangerZone")}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deactivating}
                  >
                    {deactivating && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {t("deactivate")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deactivateTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("deactivateDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deactivating}>
                      {t("cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeactivate}
                      disabled={deactivating}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {t("confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <p className="px-4 text-sm text-muted-foreground">{t("noData")}</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
