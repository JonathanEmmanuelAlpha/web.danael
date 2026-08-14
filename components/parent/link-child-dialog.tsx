"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, UserPlus } from "lucide-react";
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
  TextField,
  SelectField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { linkChildAction } from "@/server/actions/parent";

interface LinkChildDialogProps {
  trigger?: React.ReactNode;
}

const linkChildSchema = z.object({
  email: z
    .string()
    .min(1, "L'email est requis")
    .email("Adresse email invalide"),
  relationship: z.enum(["parent", "guardian", "sibling", "other"]),
});

type LinkChildValues = z.infer<typeof linkChildSchema>;

/**
 * §5.14 — Dialog used by parents to link a child via the student's email.
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn wrappers (TextField for the
 * email, SelectField for the relationship) — no more useState + manual
 * `if (!email.trim())` validation.
 */
export function LinkChildDialog({ trigger }: LinkChildDialogProps) {
  const t = useTranslations("Parent");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      relationship: "parent",
    } as LinkChildValues,
    validators: {
      onChange: linkChildSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await linkChildAction({
        studentEmail: value.email.trim().toLowerCase(),
        relationship: value.relationship,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("linkFailed"));
        return;
      }
      toast.success(t("childLinked"));
      setOpen(false);
      form.reset();
      router.push(`/children/${result.data.studentId}`);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand">
            <UserPlus className="size-4" />
            {t("linkChild")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary-600" />
            {t("linkChild")}
          </DialogTitle>
          <DialogDescription>{t("linkChildDescription")}</DialogDescription>
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
                label={t("childEmail")}
                description={t("childEmailHint")}
                placeholder="eleve@exemple.org"
                type="email"
                required
                leading={<Mail className="size-4" />}
                inputClassName="h-11 pl-9"
              />
            )}
          </form.Field>

          <form.Field name="relationship">
            {(field) => (
              <SelectField
                field={field}
                label={t("relationship")}
                options={[
                  { value: "parent", label: t("relationshipParent") },
                  { value: "guardian", label: t("relationshipGuardian") },
                  { value: "sibling", label: t("relationshipSibling") },
                  { value: "other", label: t("relationshipOther") },
                ]}
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
                  {tCommon("cancel")}
                </Button>
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  {t("addChild")}
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
