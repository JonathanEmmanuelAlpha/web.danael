"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Mail, UserPlus, Send } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TextField,
  TextAreaField,
  SelectField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { createInvitationAction } from "@/server/actions/memberships";
import type { RoleInSchoolValue } from "@/server/db/schema/enums";

interface InviteMemberDialogProps {
  targetType: "school" | "class";
  targetId: string;
  defaultRole?: RoleInSchoolValue;
  allowedRoles?: RoleInSchoolValue[];
  trigger?: React.ReactNode;
  buttonLabel?: string;
}

const inviteSchema = z.object({
  email: z
    .string()
    .email("Adresse email invalide")
    .min(1, "L'email est requis"),
  roleInTarget: z.enum(["admin", "teacher", "student", "parent", "staff"]),
  message: z
    .string()
    .max(500, "Message trop long (500 caractères max)")
    .optional(),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

/**
 * §5.3 — Dialog to invite a user (teacher / student / staff) to a school or class.
 *
 * This is the IMPROVED version:
 *  - Uses TanStack Form (not useState)
 *  - Uses shadcn Input (not native HTML input)
 *  - Creates an in-app invitation (visible in /invitations) + sends email
 *  - Optional personal message
 */
export function InviteMemberDialog({
  targetType,
  targetId,
  defaultRole = "teacher",
  allowedRoles = ["teacher", "student", "parent", "staff"],
  trigger,
  buttonLabel,
}: InviteMemberDialogProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      roleInTarget: defaultRole,
      message: "",
    } as InviteFormValues,
    validators: {
      onChange: inviteSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await createInvitationAction({
        targetType,
        targetId,
        inviteeEmail: value.email.trim().toLowerCase(),
        roleInTarget: value.roleInTarget,
        message: value.message?.trim() || undefined,
      });
      if (!result.success) {
        toast.error(
          result.error?.message ?? "Impossible d'envoyer l'invitation",
        );
        return;
      }
      toast.success(`Invitation envoyée à ${value.email}`);
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });

  const roleOptions = allowedRoles.map((r) => ({
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
          <Button variant="brand">
            <UserPlus className="size-4" />
            {buttonLabel ?? t("inviteMember")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary-600" />
            {buttonLabel ?? t("inviteMember")}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {t("inviteMemberDesc")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="email">
            {(field) => (
              <TextField
                field={field}
                label="Email"
                placeholder="me@exemple.org"
                required
                type="email"
                leading={<Mail className="size-4" />}
              />
            )}
          </form.Field>

          {roleOptions.length > 1 && (
            <form.Field name="roleInTarget">
              {(field) => (
                <SelectField field={field} label="Rôle" options={roleOptions} />
              )}
            </form.Field>
          )}

          <form.Field name="message">
            {(field) => (
              <TextAreaField
                field={field}
                label="Message"
                placeholder="message..."
                rows={3}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <DialogFooter>
                <Button
                  type="button"
                  variant="amber"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  {tCommon("cancel")}
                </Button>
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  <Send className="size-4" />
                  {buttonLabel ?? t("inviteMember")}
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
