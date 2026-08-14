"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
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
import { LEVELS, SERIES } from "@/types";
import { createClassAction } from "@/server/actions/classes";

interface CreateClassDialogProps {
  schoolId: string;
  academicYear?: string;
  trigger?: React.ReactNode;
}

const createClassSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  level: z.enum(["6e", "5e", "4e", "3e", "2nde", "1ere", "Tle"]),
  series: z.enum(["none", "A", "B", "C", "D", "E", "F", "G", "TI"]),
  year: z.string().max(20),
});

type CreateClassFormValues = z.infer<typeof createClassSchema>;

/**
 * §5.3 — Dialog used by school admins to create a new class.
 *
 * NOTE: As of this refactor, ONLY `school_admin` (and `platform_admin`)
 * can create classes — see `createClassAction` in `server/actions/classes.ts`.
 * Teachers must be invited to existing classes or join via invite code.
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn Input (not native HTML inputs).
 * The invite code is auto-generated server-side; only the human-readable
 * fields are collected here.
 */
export function CreateClassDialog({
  schoolId,
  academicYear,
  trigger,
}: CreateClassDialogProps) {
  const t = useTranslations("Classes");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      level: "2nde",
      series: "none",
      year: academicYear ?? "",
    } as CreateClassFormValues,
    validators: {
      onChange: createClassSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await createClassAction({
        schoolId,
        name: value.name.trim(),
        level: value.level as Parameters<typeof createClassAction>[0]["level"],
        series:
          value.series === "none"
            ? undefined
            : (value.series as Parameters<typeof createClassAction>[0]["series"]),
        academicYear: value.year.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("createClass"));
        return;
      }
      toast.success(t("classCreated"));
      setOpen(false);
      form.reset();
      router.push(`/classes/${result.data.id}`);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand">
            <Plus className="size-4" />
            {t("createClass")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createClass")}</DialogTitle>
          <DialogDescription>{t("createClassDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="name">
            {(field) => (
              <TextField
                field={field}
                label={t("className")}
                placeholder={t("classNamePlaceholder")}
                required
                autoFocus
              />
            )}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <form.Field name="level">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("level")}
                  options={LEVELS.map((l) => ({
                    value: l,
                    label: t(`levelLabels.${l}` as const),
                  }))}
                />
              )}
            </form.Field>

            <form.Field name="series">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("series")}
                  options={[
                    { value: "none", label: tCommon("none") },
                    ...SERIES.map((s) => ({ value: s, label: s })),
                  ]}
                />
              )}
            </form.Field>

            <form.Field name="year">
              {(field) => (
                <TextField
                  field={field}
                  label={t("academicYear")}
                  placeholder={t("academicYearPlaceholder")}
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
                  {tCommon("create")}
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
