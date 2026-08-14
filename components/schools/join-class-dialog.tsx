"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, UserPlus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TextField,
  SelectField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { joinClassByCodeAction } from "@/server/actions/memberships";
import {
  ROLE_IN_SCHOOL_VALUES,
  type RoleInSchoolValue,
} from "@/server/db/schema/enums";

interface JoinClassDialogProps {
  trigger?: React.ReactNode;
  defaultRole?: RoleInSchoolValue;
  /** Restrict selectable roles (e.g. students only join as student). */
  allowedRoles?: RoleInSchoolValue[];
}

const joinClassSchema = z.object({
  inviteCode: z
    .string()
    .min(4, "Code invalide")
    .max(20, "Code trop long")
    .regex(/^[A-Z0-9]+$/, "Le code ne doit contenir que des majuscules et des chiffres"),
  role: z.enum(["admin", "teacher", "student", "parent", "staff"]),
});

type JoinClassFormValues = z.infer<typeof joinClassSchema>;

/**
 * §5.3 — Dialog to join a class by invite code.
 *
 * Improved version:
 *  - Uses TanStack Form (not useState)
 *  - Uses shadcn Input (not native HTML input)
 *  - Real-time uppercase transformation
 *  - Better validation feedback
 */
export function JoinClassDialog({
  trigger,
  defaultRole = "student",
  allowedRoles,
}: JoinClassDialogProps) {
  const t = useTranslations("Classes");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      inviteCode: "",
      role: defaultRole,
    } as JoinClassFormValues,
    validators: {
      onChange: joinClassSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await joinClassByCodeAction({
        code: value.inviteCode.toUpperCase(),
        role: value.role,
      });
      if (!result.success || !result.data) {
        toast.error(result.error?.message ?? t("invalidCode"));
        return;
      }
      toast.success(t("classJoined", { name: result.data.class.name }));
      setOpen(false);
      form.reset();
      router.push(`/classes/${result.data.class.id}`);
      router.refresh();
    },
  });

  const roleOptions = (allowedRoles ?? ROLE_IN_SCHOOL_VALUES).map((r) => ({
    value: r,
    label: roleLabel(r),
  }));

  function roleLabel(r: RoleInSchoolValue): string {
    const labels: Record<RoleInSchoolValue, string> = {
      admin: "Administrateur",
      teacher: "Enseignant",
      student: "Élève",
      parent: "Parent",
      staff: "Personnel",
    };
    return labels[r] ?? r;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand-outline">
            <KeyRound className="size-4" />
            {t("joinClass")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary-600" />
            {t("joinClass")}
          </DialogTitle>
          <DialogDescription>{t("joinClassDescription")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="inviteCode">
            {(field) => (
              <TextField
                field={field}
                label={t("inviteCode")}
                placeholder={t("joinClassCodePlaceholder")}
                required
                inputClassName="font-mono uppercase tracking-widest"
              />
            )}
          </form.Field>

          {roleOptions.length > 1 && (
            <form.Field name="role">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("joinAsRole")}
                  options={roleOptions}
                />
              )}
            </form.Field>
          )}

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  {tCommon("cancel")}
                </Button>
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  <ArrowRight className="size-4" />
                  {t("joinClass")}
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
