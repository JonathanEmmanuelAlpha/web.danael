"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send, FileText, X, CheckCircle2 } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileUploader, type UploadedFile } from "@/components/forms/file-uploader";
import {
  TextAreaField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import {
  submitAssignmentAction,
  resubmitAssignmentAction,
} from "@/server/actions/assignments";
import type { SubmissionWithRelations } from "@/server/services/assignments";

interface SubmissionFormProps {
  assignmentId: string;
  /** Existing submission (when resubmitting). */
  existingSubmission?: SubmissionWithRelations;
  /** Whether late submissions are allowed. */
  allowLate?: boolean;
  /** Whether the deadline has passed. */
  isLate?: boolean;
  /** Called after a successful submit. */
  onSubmitted?: () => void;
  /** Cancel handler. */
  onCancel?: () => void;
}

const submissionSchema = z.object({
  comment: z.string().max(5000).optional().or(z.literal("")),
});

type SubmissionFormValues = z.infer<typeof submissionSchema>;

/**
 * §5.5 — Student submission form.
 *
 * IMPROVED: Uses TanStack Form + Zod for the comment field.
 * File uploads stay in useState (driven by the custom <FileUploader />).
 *
 * - Uploads files via the shared FileUploader (which posts to /api/files/*).
 * - Captures an optional comment / text answer.
 * - Submits the assignment (creating or updating the submission row).
 */
export function SubmissionForm({
  assignmentId,
  existingSubmission,
  allowLate,
  isLate,
  onSubmitted,
  onCancel,
}: SubmissionFormProps) {
  const t = useTranslations("Assignments");
  const tCommon = useTranslations("Common");
  const isResubmit = !!existingSubmission;

  const [fileIds, setFileIds] = useState<string[]>(
    existingSubmission?.files.map((f) => f.id) ?? [],
  );
  const [formError, setFormError] = useState<string | null>(null);

  const blockedByDeadline = isLate && !allowLate;

  function handleUploaded(file: UploadedFile) {
    if (file.id) {
      const id: string = file.id;
      setFileIds((prev) => [...prev, id]);
    }
  }

  function handleRemoveFile(id: string) {
    setFileIds((prev) => prev.filter((f) => f !== id));
  }

  const form = useForm({
    defaultValues: {
      comment: existingSubmission?.feedback ?? "",
    } as SubmissionFormValues,
    validators: {
      onChange: submissionSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (blockedByDeadline) {
        setFormError(t("deadlinePassed"));
        return;
      }

      if (fileIds.length === 0 && !value.comment?.trim()) {
        setFormError(t("formErrors.textRequired"));
        return;
      }

      if (isResubmit && existingSubmission) {
        const res = await resubmitAssignmentAction({
          submissionId: existingSubmission.id,
          comment: value.comment?.trim() || null,
          fileIds,
        });
        if (!res.success) {
          toast.error(res.error?.message ?? t("resubmit"));
          return;
        }
        toast.success(t("submissionUpdated"));
        onSubmitted?.();
        return;
      }

      const res = await submitAssignmentAction({
        assignmentId,
        studentId: "", // overridden by the action
        comment: value.comment?.trim() || undefined,
        fileIds,
      });
      if (!res.success) {
        toast.error(res.error?.message ?? t("submit"));
        return;
      }
      toast.success(t("submissionSent"));
      onSubmitted?.();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-5"
    >
      {/* Comment */}
      <form.Field name="comment">
        {(field) => (
          <TextAreaField
            field={field}
            label={t("comment")}
            placeholder={t("commentHint")}
            rows={4}
          />
        )}
      </form.Field>

      {/* Files */}
      <div className="space-y-2">
        <Label>{t("files")}</Label>
        <p className="text-xs text-muted-foreground">{t("filesHint")}</p>

        {fileIds.length > 0 && (
          <ul className="space-y-1.5">
            {fileIds.map((id) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <FileText className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate text-sm text-muted-foreground">
                  {id}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleRemoveFile(id)}
                  aria-label={tCommon("delete")}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!blockedByDeadline && (
          <FileUploader
            multiple
            category="submission"
            accept="application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
            onUploaded={handleUploaded}
            hint={t("filesHint")}
          />
        )}
      </div>

      {blockedByDeadline && (
        <FormErrorBanner message={t("lateSubmissionsNotAllowed")} />
      )}
      <FormErrorBanner message={formError} />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
      >
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                <X className="size-4" />
                {tCommon("cancel")}
              </Button>
            )}
            <SubmitButton
              pending={isSubmitting}
              disabled={!canSubmit || blockedByDeadline}
            >
              {isResubmit ? (
                <>
                  <CheckCircle2 className="size-4" />
                  {t("resubmit")}
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  {t("submit")}
                </>
              )}
            </SubmitButton>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
