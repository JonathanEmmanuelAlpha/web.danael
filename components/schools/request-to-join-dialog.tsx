"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Send, UserPlus } from "lucide-react";
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
import {
  TextAreaField,
  SelectField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import {
  requestToJoinSchoolAction,
  requestToJoinClassAction,
} from "@/server/actions/memberships";
import {
  ROLE_IN_SCHOOL_VALUES,
  type RoleInSchoolValue,
} from "@/server/db/schema/enums";

interface RequestToJoinDialogProps {
  targetType: "school" | "class";
  targetId: string;
  targetName: string;
  trigger?: React.ReactNode;
  defaultRole?: RoleInSchoolValue;
  allowedRoles?: RoleInSchoolValue[];
}

const requestSchema = z.object({
  role: z.enum(["admin", "teacher", "student", "parent", "staff"]),
  message: z.string().max(500, "Message trop long").optional(),
});

type RequestFormValues = z.infer<typeof requestSchema>;

/**
 * Dialog to send a request-to-join (without an access code).
 *
 * Used when a student/teacher finds a school/class via search or browse
 * and wants to ask the admin for access. The admin can then approve/reject.
 */
export function RequestToJoinDialog({
  targetType,
  targetId,
  targetName,
  trigger,
  defaultRole = "student",
  allowedRoles = ["student", "teacher", "parent", "staff"],
}: RequestToJoinDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      role: defaultRole,
      message: "",
    } as RequestFormValues,
    validators: { onChange: requestSchema },
    onSubmit: async ({ value }) => {
      const action =
        targetType === "school"
          ? requestToJoinSchoolAction
          : requestToJoinClassAction;
      const result = await action({
        [targetType === "school" ? "schoolId" : "classId"]: targetId,
        role: value.role,
        message: value.message?.trim() || undefined,
      } as never);
      if (!result.success) {
        toast.error(result.error?.message ?? "Impossible d'envoyer la demande");
        return;
      }
      toast.success(`Demande envoyée à ${targetName}`);
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
          <Button variant="outline">
            <UserPlus className="size-4" />
            Demander à rejoindre
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary-600" />
            Rejoindre « {targetName} »
          </DialogTitle>
          <DialogDescription>
            Votre demande sera examinée par l'administrateur de{" "}
            {targetType === "school" ? "l'école" : "la classe"}. Vous serez
            notifié de sa décision.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="role">
            {(field) => (
              <SelectField
                field={field}
                label="Je rejoins en tant que"
                options={roleOptions}
              />
            )}
          </form.Field>

          <form.Field name="message">
            {(field) => (
              <TextAreaField
                field={field}
                label="Message (optionnel)"
                placeholder="Présentez-vous brièvement..."
                rows={4}
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
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  <Send className="size-4" />
                  Envoyer la demande
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
