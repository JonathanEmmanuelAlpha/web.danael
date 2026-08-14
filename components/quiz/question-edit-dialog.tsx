"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TextField,
  TextAreaField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { QuestionSourceBadge } from "./question-source-badge";
import {
  editQuestionAction,
  verifyQuestionAction,
} from "@/server/actions/ai-questions";
import type { GeneratedQuestionListItem } from "@/server/services/ai-questions";

interface QuestionEditDialogProps {
  question: GeneratedQuestionListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  onVerified?: () => void;
}

const optionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Required").max(500),
  isCorrect: z.boolean(),
});

const editSchema = z.object({
  label: z.string().min(2, "Min 2 characters").max(2000),
  explanation: z.string().max(2000).optional().or(z.literal("")),
  options: z.array(optionSchema).max(10),
});

type EditValues = z.infer<typeof editSchema>;

const NEEDS_OPTIONS = new Set(["single_choice", "multiple_choice", "true_false"]);

/**
 * §10.4 — Edit dialog for an AI-generated question (TanStack Form + Zod).
 *
 * Lets the teacher:
 *  - Edit the question label and explanation
 *  - Edit the options (add / remove / toggle correct) for MCQ / true_false
 *  - Save changes (without verifying) — the question stays `source=generated`
 *  - Save & verify — flips the question to `source=verified`
 *
 * The "save & verify" intent is captured in a `verifyAfterSaveRef` flag so we
 * can reuse the form's native validation flow via `form.handleSubmit()`.
 */
export function QuestionEditDialog({
  question,
  open,
  onOpenChange,
  onSaved,
  onVerified,
}: QuestionEditDialogProps) {
  const t = useTranslations("AiQuestions");

  const needsOptions = question
    ? NEEDS_OPTIONS.has(question.type)
    : false;

  // Intent flag — set by the "Save & verify" button before submitting.
  const verifyAfterSaveRef = React.useRef(false);

  const form = useForm({
    defaultValues: {
      label: question?.label ?? "",
      explanation: question?.explanation ?? "",
      options: (question?.options ?? []).map((o) => ({
        id: o.id,
        label: o.label,
        isCorrect: o.isCorrect,
      })),
    } as EditValues,
    validators: {
      onChange: editSchema,
    },
    onSubmit: async ({ value }) => {
      if (!question) return;
      const result = await editQuestionAction({
        questionId: question.id,
        label: value.label.trim(),
        explanation: value.explanation?.trim() || undefined,
        options: needsOptions
          ? value.options.map((o) => ({
              id: o.id,
              label: o.label,
              isCorrect: o.isCorrect,
            }))
          : undefined,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("edit"));
        return;
      }

      if (verifyAfterSaveRef.current) {
        const verifyRes = await verifyQuestionAction({ questionId: question.id });
        if (!verifyRes.success) {
          toast.error(verifyRes.error?.message ?? t("verify"));
          verifyAfterSaveRef.current = false;
          return;
        }
        toast.success(t("verifiedSuccess"));
        verifyAfterSaveRef.current = false;
        onVerified?.();
      } else {
        toast.success(t("editSuccess"));
        onSaved?.();
      }
      onOpenChange(false);
    },
  });

  // Re-sync the form when the question changes (different dialog open).
  React.useEffect(() => {
    if (!open) return;
    verifyAfterSaveRef.current = false;
    form.reset({
      label: question?.label ?? "",
      explanation: question?.explanation ?? "",
      options: (question?.options ?? []).map((o) => ({
        id: o.id,
        label: o.label,
        isCorrect: o.isCorrect,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("edit")}
            {question ? (
              <QuestionSourceBadge source={question.source} />
            ) : null}
          </DialogTitle>
          <DialogDescription>{t("edit")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyAfterSaveRef.current = false;
            void form.handleSubmit();
          }}
          className="space-y-5"
        >
          <form.Field name="label">
            {(field) => (
              <TextField
                field={field}
                label="Label"
                placeholder="Question text…"
                required
                autoFocus
              />
            )}
          </form.Field>

          <form.Field name="explanation">
            {(field) => (
              <TextAreaField
                field={field}
                label="Explanation"
                placeholder="Why is the correct answer right?"
                rows={3}
              />
            )}
          </form.Field>

          {needsOptions ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("optionsEditor")}</Label>
              <form.Field name="options">
                {(field) => (
                  <OptionsEditor
                    field={field as never}
                    needsSingleCorrect={
                      question?.type === "single_choice" ||
                      question?.type === "true_false"
                    }
                  />
                )}
              </form.Field>
            </div>
          ) : null}

          <form.Subscribe
            selector={(state) =>
              [state.canSubmit, state.isSubmitting] as const
            }
          >
            {([canSubmit, isSubmitting]) => (
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  {t("clearSelection")}
                </Button>
                <SubmitButton
                  pending={isSubmitting}
                  disabled={!canSubmit}
                  variant="outline"
                >
                  {t("saveChanges")}
                </SubmitButton>
                <Button
                  type="button"
                  variant="brand"
                  disabled={!canSubmit || isSubmitting}
                  onClick={() => {
                    verifyAfterSaveRef.current = true;
                    void form.handleSubmit();
                  }}
                >
                  <Check className="size-4" />
                  {t("saveAndVerify")}
                </Button>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Options editor (sub-component) ────────────────────────── */

interface OptionsEditorProps {
  // The field is a TanStack Form FieldApi for an array; typed loosely here to
  // avoid leaking the heavy generic from useForm into the sub-component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: any;
  needsSingleCorrect: boolean;
}

function OptionsEditor({ field, needsSingleCorrect }: OptionsEditorProps) {
  const t = useTranslations("AiQuestions");
  const options: EditValues["options"] = (field.state.value ?? []) as EditValues["options"];

  function update(idx: number, patch: Partial<EditValues["options"][number]>) {
    const next = options.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    field.handleChange(next as never);
  }

  function add() {
    field.handleChange([
      ...options,
      { label: "", isCorrect: false },
    ] as never);
  }

  function remove(idx: number) {
    field.handleChange(
      options.filter((_, i) => i !== idx) as never,
    );
  }

  function toggleCorrect(idx: number) {
    if (needsSingleCorrect) {
      // For single_choice / true_false: only one correct.
      const next = options.map((o, i) => ({
        ...o,
        isCorrect: i === idx,
      }));
      field.handleChange(next as never);
    } else {
      const opt = options[idx];
      if (!opt) return;
      update(idx, { isCorrect: !opt.isCorrect });
    }
  }

  return (
    <div className="space-y-2">
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("addOption")}</p>
      ) : null}
      {options.map((opt, idx) => (
        <div
          key={opt.id ?? idx}
          className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2"
        >
          <button
            type="button"
            onClick={() => toggleCorrect(idx)}
            className={`flex size-7 shrink-0 items-center justify-center rounded-md border transition ${
              opt.isCorrect
                ? "border-green-500/40 bg-green-500/15 text-green-400"
                : "border-border text-muted-foreground hover:border-green-500/30 hover:text-green-400"
            }`}
            aria-pressed={opt.isCorrect}
            aria-label={t("markAsCorrect")}
            title={t("markAsCorrect")}
          >
            <Check className="size-3.5" />
          </button>
          <Input
            value={opt.label}
            onChange={(e) => update(idx, { label: e.target.value })}
            placeholder={t("optionLabel")}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(idx)}
            aria-label={t("removeOption")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full border-dashed"
      >
        <Plus className="size-4" />
        {t("addOption")}
      </Button>
    </div>
  );
}
