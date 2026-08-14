"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Award, Undo2, FileText, Star } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  NumberField,
  TextAreaField,
  SelectField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { SubmissionStatusBadge } from "./submission-status-badge";
import {
  gradeSubmissionAction,
  returnSubmissionAction,
} from "@/server/actions/assignments";
import type { SubmissionWithRelations } from "@/server/services/assignments";

interface GradeSubmissionDialogProps {
  submission: SubmissionWithRelations;
  /** Max points possible for this assignment (used as a hint). */
  maxPoints?: number;
  /** Children to use as the dialog trigger. */
  trigger?: React.ReactNode;
  /** Called after a successful grade / return. */
  onGraded?: () => void;
}

const gradeSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().max(5000).optional().or(z.literal("")),
  status: z.enum(["graded", "returned"]),
});

type GradeFormValues = z.infer<typeof gradeSchema>;

/**
 * §5.5 — Grade / return submission dialog.
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn wrappers (NumberField,
 * TextAreaField, SelectField, SubmitButton).
 *
 * Allows the teacher to set a score, leave feedback and either "grade"
 * (status=graded) or "return" (status=returned) the submission.
 */
export function GradeSubmissionDialog({
  submission,
  maxPoints,
  trigger,
  onGraded,
}: GradeSubmissionDialogProps) {
  const t = useTranslations("Assignments");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [returning, setReturning] = useState(false);

  const studentName =
    [submission.student.firstName, submission.student.lastName]
      .filter(Boolean)
      .join(" ") || submission.student.email;

  const form = useForm({
    defaultValues: {
      score: submission.score ?? 0,
      feedback: submission.feedback ?? "",
      status: "graded" as "graded" | "returned",
    } as GradeFormValues,
    validators: {
      onChange: gradeSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await gradeSubmissionAction({
        id: submission.id,
        score: value.score,
        feedback: value.feedback?.trim() || undefined,
        gradedBy: "", // overridden by the action
        status: value.status,
      });

      if (!res.success) {
        toast.error(res.error?.message ?? t("grade"));
        return;
      }

      toast.success(
        value.status === "graded"
          ? t("submissionGraded")
          : t("submissionReturned"),
      );
      setOpen(false);
      onGraded?.();
    },
  });

  async function handleReturn() {
    setReturning(true);
    const res = await returnSubmissionAction(submission.id);
    setReturning(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("grade"));
      return;
    }
    toast.success(t("submissionReturned"));
    setOpen(false);
    onGraded?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand" size="sm">
            <Award className="size-4" />
            {t("grade")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("grade")}</DialogTitle>
          <DialogDescription>
            {studentName} · {submission.assignment.title}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Submission preview */}
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("submission")}
              </span>
              <SubmissionStatusBadge status={submission.status} />
            </div>
            {submission.submittedAt ? (
              <p className="text-xs text-muted-foreground">
                {t("submittedAt")}{" "}
                {new Date(submission.submittedAt).toLocaleString()}
              </p>
            ) : null}
            {submission.files.length > 0 ? (
              <ul className="space-y-1">
                {submission.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 text-xs text-foreground"
                  >
                    <FileText className="size-3.5 text-muted-foreground" />
                    <a
                      href={`/api/files/download-url?key=${encodeURIComponent(file.key)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-primary-700 hover:underline dark:text-primary-400"
                    >
                      {file.originalName}
                    </a>
                    <span className="ml-auto text-muted-foreground">
                      {Math.round(file.size / 1024)} KB
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t("noFiles")}</p>
            )}
            {submission.feedback && (
              <div className="mt-2 rounded-lg border border-border bg-background p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("comment")}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">
                  {submission.feedback}
                </p>
              </div>
            )}
          </div>

          {/* Score + status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.Field name="score">
              {(field) => (
                <NumberField
                  field={field}
                  label={
                    <>
                      {t("score")}
                      {maxPoints ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t("ofPoints", { max: maxPoints })})
                        </span>
                      ) : null}
                    </>
                  }
                  min={0}
                  max={100}
                  step={0.5}
                  required
                />
              )}
            </form.Field>
            <form.Field name="status">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("status")}
                  options={[
                    {
                      value: "graded",
                      label: (
                        <Badge variant="success" size="sm">
                          <Star className="size-3" />
                          {t("graded")}
                        </Badge>
                      ),
                    },
                    {
                      value: "returned",
                      label: (
                        <Badge variant="brand" size="sm">
                          <Undo2 className="size-3" />
                          {t("returned")}
                        </Badge>
                      ),
                    },
                  ]}
                />
              )}
            </form.Field>
          </div>

          <form.Field name="feedback">
            {(field) => (
              <TextAreaField
                field={field}
                label={t("feedback")}
                placeholder={t("feedbackHint")}
                rows={4}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleReturn}
                  disabled={isSubmitting || returning}
                >
                  {returning ? (
                    <Undo2 className="size-4 animate-spin" />
                  ) : (
                    <Undo2 className="size-4" />
                  )}
                  {t("returned")}
                </Button>
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  {tCommon("save")}
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
