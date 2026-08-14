"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Megaphone, Plus } from "lucide-react";
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
  TextAreaField,
  SelectField,
  SwitchField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { createAnnouncementAction } from "@/server/actions/messaging";
import { AUDIENCE_VALUES, type AudienceValue } from "@/server/db/schema/enums";

export interface CreateAnnouncementDialogProps {
  /** Optional schoolId to scope the announcement (auto-set). */
  schoolId?: string;
  /** Optional classId to scope the announcement (auto-set). */
  classId?: string;
  /** Restrict audience options (e.g. class page → only class audience). */
  restrictAudience?: AudienceValue[];
  trigger?: React.ReactNode;
}

const createAnnouncementSchema = z.object({
  title: z
    .string()
    .min(3, "Le titre doit comporter au moins 3 caractères")
    .max(200),
  body: z
    .string()
    .min(10, "Le contenu doit comporter au moins 10 caractères")
    .max(5000),
  audience: z.enum([
    "school",
    "class",
    "teachers",
    "students",
    "parents",
    "public",
  ]),
  publish: z.boolean(),
});

type CreateAnnouncementValues = z.infer<typeof createAnnouncementSchema>;

/**
 * §5.11 — Dialog for school_admin / teacher to publish an announcement.
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn wrappers (TextField,
 * TextAreaField, SelectField, SwitchField) — no more useState + manual
 * `if (!title.trim())` validation.
 */
export function CreateAnnouncementDialog({
  schoolId,
  classId,
  restrictAudience,
  trigger,
}: CreateAnnouncementDialogProps) {
  const t = useTranslations("Messaging");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const audiences = restrictAudience ?? (AUDIENCE_VALUES as readonly AudienceValue[]);

  const form = useForm({
    defaultValues: {
      title: "",
      body: "",
      audience: (restrictAudience?.[0] ?? (classId ? "class" : "school")) as
        | "school"
        | "class"
        | "teachers"
        | "students"
        | "parents"
        | "public",
      publish: true,
    } as CreateAnnouncementValues,
    validators: {
      onChange: createAnnouncementSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await createAnnouncementAction({
        title: value.title.trim(),
        body: value.body.trim(),
        audience: value.audience,
        schoolId:
          value.audience === "class" || value.audience === "school"
            ? schoolId
            : schoolId,
        classId: value.audience === "class" ? classId : undefined,
        publish: value.publish,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("createAnnouncement"));
        return;
      }
      toast.success(t("announcementCreated"));
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand">
            <Plus className="size-4" />
            {t("newAnnouncement")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-primary-600" aria-hidden />
            {t("newAnnouncement")}
          </DialogTitle>
          <DialogDescription>{t("newAnnouncementDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="title">
            {(field) => (
              <TextField
                field={field}
                label={t("titleField")}
                placeholder={t("titlePlaceholder")}
                required
                autoFocus
              />
            )}
          </form.Field>

          <form.Field name="body">
            {(field) => (
              <TextAreaField
                field={field}
                label={t("bodyField")}
                placeholder={t("bodyPlaceholder")}
                required
                rows={5}
              />
            )}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.Field name="audience">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("audience")}
                  options={audiences.map((a) => ({
                    value: a,
                    label: t(`audienceLabel_${a}` as const),
                  }))}
                />
              )}
            </form.Field>

            <form.Field name="publish">
              {(field) => (
                <SwitchField
                  field={field}
                  label={t("publishNow")}
                  description={
                    field.state.value
                      ? t("publishImmediately")
                      : t("saveAsDraft")
                  }
                />
              )}
            </form.Field>
          </div>

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
                  {t("publish")}
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
