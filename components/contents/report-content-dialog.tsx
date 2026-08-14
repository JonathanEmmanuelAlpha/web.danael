"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldAlert, Send } from "lucide-react";
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
import { TextAreaField, SubmitButton } from "@/components/forms/tanstack-fields";
import { reportContentAction } from "@/server/actions/contents";

export interface ReportContentDialogProps {
  contentId: string;
  trigger?: React.ReactNode;
}

const reportSchema = z.object({
  reason: z
    .string()
    .max(2000)
    .refine(
      (v) => v.trim().length >= 5,
      "Reason must be at least 5 characters",
    ),
});

type ReportFormValues = z.infer<typeof reportSchema>;

/**
 * Dialog for the user to submit a moderation report on a content.
 */
export function ReportContentDialog({
  contentId,
  trigger,
}: ReportContentDialogProps) {
  const t = useTranslations("Contents");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      reason: "",
    } as ReportFormValues,
    validators: {
      onChange: reportSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await reportContentAction({
        contentId,
        reason: value.reason.trim(),
      });
      if (!res.success) {
        toast.error(res.error?.message ?? t("reportError"));
        return;
      }
      toast.success(t("reportSent"));
      form.reset();
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <ShieldAlert className="size-4" />
            {t("report")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("report")}</DialogTitle>
          <DialogDescription>{t("reportDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="reason">
            {(field) => (
              <TextAreaField
                field={field}
                label={t("reportReason")}
                placeholder={t("reportReasonPlaceholder")}
                rows={5}
                required
              />
            )}
          </form.Field>
          <form.Subscribe
            selector={(state) =>
              [state.isSubmitting, state.values.reason] as const
            }
          >
            {([isSubmitting, reason]) => (
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  {tCommon("cancel")}
                </Button>
                <SubmitButton
                  pending={isSubmitting}
                  disabled={reason.trim().length < 5}
                  variant="destructive"
                >
                  <Send className="size-4" />
                  {t("report")}
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
