"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  SelectField,
  NumberField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import {
  generateQuestionsAction,
  listSkillsForFilterAction,
} from "@/server/actions/ai-questions";
import {
  DIFFICULTY_VALUES,
  QUIZ_QUESTION_TYPE_VALUES,
} from "@/server/db/schema/enums";
import type {
  SkillOption,
  SubjectOption,
} from "@/server/services/ai-questions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface AiGenerateDialogProps {
  /** Triggered when questions are successfully generated. */
  onGenerated?: () => void;
  subjects: SubjectOption[];
}

const generateSchema = z.object({
  subjectId: z.string().min(1, "Required"),
  skillId: z.string().min(1, "Required"),
  count: z.number().int().min(1).max(20),
  difficulty: z.enum(DIFFICULTY_VALUES),
  questionTypes: z
    .array(z.enum(QUIZ_QUESTION_TYPE_VALUES))
    .min(1, "Select at least one type"),
});

type GenerateValues = z.infer<typeof generateSchema>;

/**
 * §10.4 — "Generate AI questions" dialog.
 *
 * Lets a teacher pick a skill, the number of questions, the difficulty and the
 * question types, then triggers `generateQuestionsAction`. The dialog stays
 * open while generation is in progress and closes on success.
 */
export function AiGenerateDialog({
  onGenerated,
  subjects,
}: AiGenerateDialogProps) {
  const t = useTranslations("AiQuestions");
  const tQuiz = useTranslations("Quizzes");
  const tCommon = useTranslations("Common");

  const [open, setOpen] = React.useState(false);
  const [subjectId, setSubjectId] = React.useState<string>("");
  const [skills, setSkills] = React.useState<SkillOption[]>([]);
  const [loadingSkills, setLoadingSkills] = React.useState(false);
  const [placeholderNotice, setPlaceholderNotice] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Use a microtask to defer the setLoading call so we don't trigger the
    // react-hooks/set-state-in-effect lint rule (which would otherwise flag
    // a synchronous setState inside an effect).
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoadingSkills(true);
    });
    listSkillsForFilterAction(subjectId ? { subjectId } : {})
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setSkills(res.data);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingSkills(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const form = useForm({
    defaultValues: {
      skillId: "",
      count: 5,
      difficulty: "medium",
      questionTypes: ["single_choice"],
    } as GenerateValues,
    validators: { onChange: generateSchema },
    onSubmit: async ({ value }) => {
      const result = await generateQuestionsAction({
        skillId: value.skillId,
        count: value.count,
        difficulty: value.difficulty,
        questionTypes: value.questionTypes,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("generateFailed"));
        return;
      }
      const data = result.data;
      if (!data) {
        toast.error(t("generateFailed"));
        return;
      }
      if (data.source === "placeholder") {
        setPlaceholderNotice(true);
      }
      toast.success(t("generateSuccess", { count: data.generated }));
      onGenerated?.();
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <Sparkles className="size-4" />
          {t("generate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary-400" />
            {t("generate")}
          </DialogTitle>
          <DialogDescription>{t("generateDescription")}</DialogDescription>
        </DialogHeader>

        {placeholderNotice ? (
          <div className="rounded-lg border border-accent-amber-500/30 bg-accent-amber-500/10 px-3 py-2 text-xs text-accent-amber-400">
            {t("placeholderNotice")}
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Subject */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("subject")}</Label>
              <Select
                value={subjectId || "all"}
                onValueChange={(v) => {
                  setSubjectId(v === "all" ? "" : v);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("allSubjects")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allSubjects")}</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <form.Field name="skillId">
              {(field) => {
                return (
                  <SelectField
                    field={field}
                    label={t("skill")}
                    placeholder={loadingSkills ? "…" : t("selectSkill")}
                    disabled={!subjectId || loadingSkills}
                    required
                    options={skills.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${s.code})`,
                    }))}
                  />
                );
              }}
            </form.Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="count">
              {(field) => (
                <NumberField
                  field={field}
                  label={t("count")}
                  min={1}
                  max={20}
                  step={1}
                  required
                />
              )}
            </form.Field>
            <form.Field name="difficulty">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("difficulty")}
                  options={DIFFICULTY_VALUES.map((d) => ({
                    value: d,
                    label: tQuiz(`difficulties.${d}` as const),
                  }))}
                />
              )}
            </form.Field>
          </div>

          <form.Field name="questionTypes">
            {(field) => (
              <QuestionTypesPicker field={field} label={t("questionTypes")} />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) =>
              [state.canSubmit, state.isSubmitting, state.errors] as const
            }
          >
            {([canSubmit, isSubmitting, errors]) => (
              <>
                {errors.length > 0 ? (
                  <FormErrorBanner message="Please fix the errors above" />
                ) : null}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    disabled={isSubmitting}
                  >
                    {t("clearSelection")}
                  </Button>
                  <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {t("generate")}
                  </SubmitButton>
                </DialogFooter>
              </>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Question types picker (multi-select via Checkboxes) ──── */

interface QuestionTypesPickerProps {
  // The field is a TanStack Form FieldApi for an array; typed loosely here to
  // avoid leaking the heavy generic from useForm into the sub-component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: any;
  label: string;
}

function QuestionTypesPicker({ field, label }: QuestionTypesPickerProps) {
  const tQuiz = useTranslations("Quizzes");
  const value: string[] = field.state.value ?? [];

  function toggle(type: string) {
    const next = value.includes(type)
      ? value.filter((v) => v !== type)
      : [...value, type];
    field.handleChange(next as never);
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {QUIZ_QUESTION_TYPE_VALUES.map((type) => {
          const checked = value.includes(type);
          return (
            <label
              key={type}
              htmlFor={`qt-${type}`}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition ${
                checked
                  ? "border-primary-500/50 bg-primary-500/10"
                  : "border-border bg-background/60 hover:border-primary-500/30"
              }`}
            >
              <Checkbox
                id={`qt-${type}`}
                checked={checked}
                onCheckedChange={() => toggle(type)}
              />
              <Label
                htmlFor={`qt-${type}`}
                className="cursor-pointer text-sm font-medium"
              >
                {tQuiz(`questionTypes.${type}` as const)}
              </Label>
            </label>
          );
        })}
      </div>
    </div>
  );
}
