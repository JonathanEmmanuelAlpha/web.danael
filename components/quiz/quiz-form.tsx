"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useForm, useSelector } from "@tanstack/react-form";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import {
  TextField,
  TextAreaField,
  SelectField,
  NumberField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { QUIZ_TYPE_VALUES, DIFFICULTY_VALUES } from "@/server/db/schema/enums";
import type { Subject, SubjectSkill } from "@/server/db/schema/schools";
import type { CreateQuizInput } from "@/server/validators/quizzes";
import type { QuizQuestionInput } from "@/server/validators/quizzes";
import { listSubjectSkillsAction } from "@/server/actions/subjects";
import { QuestionBuilder } from "./question-builder";

interface QuizFormProps {
  mode: "create" | "edit";
  initialQuiz?: {
    id: string;
    title: string;
    description: string | null;
    subjectId: string | null;
    /** Primary skill the quiz targets (FK to subject_skills). */
    skillId: string | null;
    level: string | null;
    series: string | null;
    type: (typeof QUIZ_TYPE_VALUES)[number];
    timeLimitMinutes: number | null;
    passingScore: number | null;
    isPublished: boolean;
  };
  initialQuestions?: QuizQuestionInput[];
  subjects: Subject[];
  submitAction: (
    payload: CreateQuizInput & { id?: string },
  ) => Promise<
    | { success: true; data: { id: string } }
    | { success: false; error: { code: string; message: string } }
  >;
}

const quizSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().max(2000).optional().or(z.literal("")),
  subjectId: z.string(),
  skillId: z.string().optional(),
  level: z.string(),
  series: z.string(),
  type: z.enum(["practice", "exam", "homework", "diagnostic"]),
  timeLimit: z.number().min(0).max(600).optional(),
  passingScore: z.number().min(0).max(100),
});

type QuizFormValues = z.infer<typeof quizSchema>;

/**
 * §5.6 — Quiz create / edit form.
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn wrappers for the quiz-level
 * scalar fields (title, description, subject, level, series, type, timeLimit,
 * passingScore). The dynamic `questions[]` array (with nested validation)
 * stays in useState driven by the <QuestionBuilder /> component.
 */
export function QuizForm({
  mode,
  initialQuiz,
  initialQuestions = [],
  subjects,
  submitAction,
}: QuizFormProps) {
  const t = useTranslations("Quizzes");
  const tCommon = useTranslations("Common");
  const tClasses = useTranslations("Classes");
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionInput[]>(
    initialQuestions.length > 0 ? initialQuestions : [makeEmptyQuestion(0)],
  );

  // Skills available for the currently selected subject.
  const [availableSkills, setAvailableSkills] = useState<SubjectSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);

  function addQuestion() {
    setQuestions((qs) => [...qs, makeEmptyQuestion(qs.length)]);
  }

  function updateQuestion(idx: number, q: QuizQuestionInput) {
    setQuestions((qs) => qs.map((old, i) => (i === idx ? q : old)));
  }

  function removeQuestion(idx: number) {
    setQuestions((qs) =>
      qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, position: i })),
    );
  }

  const form = useForm({
    defaultValues: {
      title: initialQuiz?.title ?? "",
      description: initialQuiz?.description ?? "",
      subjectId: initialQuiz?.subjectId ?? "none",
      skillId: initialQuiz?.skillId ?? "",
      level: initialQuiz?.level ?? "none",
      series: initialQuiz?.series ?? "none",
      type: initialQuiz?.type ?? "practice",
      timeLimit: initialQuiz?.timeLimitMinutes ?? undefined,
      passingScore: initialQuiz?.passingScore ?? 50,
    } as QuizFormValues,
    validators: {
      onChange: quizSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null);

      if (questions.length === 0) {
        setError(t("noQuestionsHint"));
        return;
      }

      // Validate every question has a label + (if applicable) ≥2 options, ≥1 correct.
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q) continue;
        if (!q.label.trim()) {
          setError(`${t("question")} ${i + 1}: ${t("questionLabel")}`);
          return;
        }
        const needsOptions =
          q.type === "single_choice" ||
          q.type === "multiple_choice" ||
          q.type === "true_false";
        if (needsOptions) {
          if (q.options.length < 2) {
            setError(`${t("question")} ${i + 1}: ${t("minOptionsRequired")}`);
            return;
          }
          if (!q.options.some((o) => o.isCorrect)) {
            setError(
              `${t("question")} ${i + 1}: ${t("correctOptionRequired")}`,
            );
            return;
          }
          for (const opt of q.options) {
            if (!opt.label.trim()) {
              setError(`${t("question")} ${i + 1}: ${t("optionLabel")}`);
              return;
            }
          }
        }
      }

      const payload: CreateQuizInput & { id?: string } = {
        title: value.title.trim(),
        description: value.description?.trim() || undefined,
        subjectId: value.subjectId === "none" ? undefined : value.subjectId,
        skillId: value.skillId || undefined,
        level:
          value.level === "none"
            ? undefined
            : (value.level as CreateQuizInput["level"]),
        series:
          value.series === "none"
            ? undefined
            : (value.series as CreateQuizInput["series"]),
        type: value.type,
        timeLimitMinutes:
          value.timeLimit !== undefined
            ? Math.max(0, Math.min(600, value.timeLimit))
            : undefined,
        passingScore: Math.max(0, Math.min(100, value.passingScore)),
        isPublished: false, // Always save as draft; user publishes explicitly.
        questions: questions.map((q, i) => ({ ...q, position: i })),
      };
      if (mode === "edit" && initialQuiz) {
        payload.id = initialQuiz.id;
      }

      const result = await submitAction(payload);

      if (!result.success) {
        setError(result.error.message);
        return;
      }
      toast.success(mode === "create" ? t("quizCreated") : t("quizUpdated"));
      router.push(`/quizzes/${result.data.id}`);
      router.refresh();
    },
  });

  // Watch subjectId to dynamically load its skills. The quiz form uses
  // "none" as the empty-subject sentinel (vs "" in content-form), so we
  // treat that value as "no subject".
  const watchedSubjectId = useSelector(
    form.store,
    (state) => state.values.subjectId,
  );
  const hasSubject = Boolean(watchedSubjectId) && watchedSubjectId !== "none";

  useEffect(() => {
    if (!hasSubject) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailableSkills([]);
      return;
    }
    let cancelled = false;
    setSkillsLoading(true);
    listSubjectSkillsAction({
      subjectId: watchedSubjectId as string,
      includeInactive: false,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.success) setAvailableSkills(res.data);
      })
      .finally(() => {
        if (!cancelled) setSkillsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [watchedSubjectId, hasSubject]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "create" ? t("create") : t("edit")}
        description={
          mode === "create" ? t("createDescription") : t("editDescription")
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Quiz-level fields */}
        <SectionCard title={t("newQuiz")}>
          <div className="space-y-5">
            <form.Field name="title">
              {(field) => (
                <TextField
                  field={field}
                  label={t("title")}
                  placeholder={t("title")}
                  required
                  autoFocus
                />
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <TextAreaField
                  field={field}
                  label={
                    <>
                      {t("description")}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({tCommon("optional")})
                      </span>
                    </>
                  }
                  placeholder={t("descriptionPlaceholder")}
                  rows={3}
                />
              )}
            </form.Field>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <form.Field name="subjectId">
                {(field) => (
                  <SelectField
                    field={field}
                    label={t("subject")}
                    options={[
                      { value: "none", label: t("noSubject") },
                      ...subjects.map((s) => ({
                        value: s.id,
                        label: s.name,
                      })),
                    ]}
                  />
                )}
              </form.Field>

              <form.Field name="skillId">
                {(field) => {
                  const opts = availableSkills.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }));
                  return (
                    <SelectField
                      field={field}
                      label={
                        <>
                          {t("skillLabel")}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({tCommon("optional")})
                          </span>
                        </>
                      }
                      placeholder={
                        !hasSubject
                          ? t("skillSelectSubjectFirst")
                          : skillsLoading
                            ? t("skillLoading")
                            : opts.length === 0
                              ? t("skillEmpty")
                              : t("skillPlaceholder")
                      }
                      options={opts}
                      disabled={!hasSubject || skillsLoading}
                    />
                  );
                }}
              </form.Field>

              <form.Field name="level">
                {(field) => (
                  <SelectField
                    field={field}
                    label={t("level")}
                    options={[
                      { value: "none", label: tCommon("none") },
                      ...LEVELS.map((l) => ({
                        value: l,
                        label: tClasses(`levelLabels.${l}` as const),
                      })),
                    ]}
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

              <form.Field name="type">
                {(field) => (
                  <SelectField
                    field={field}
                    label={t("type")}
                    options={QUIZ_TYPE_VALUES.map((qt) => ({
                      value: qt,
                      label: t(`quizTypes.${qt}` as const),
                    }))}
                  />
                )}
              </form.Field>

              <form.Field name="timeLimit">
                {(field) => (
                  <NumberField
                    field={field}
                    label={t("timeLimit")}
                    placeholder={t("timeLimitHint")}
                    description={t("timeLimitHint")}
                    min={0}
                    max={600}
                  />
                )}
              </form.Field>

              <form.Field name="passingScore">
                {(field) => (
                  <NumberField
                    field={field}
                    label={t("passingScore")}
                    description={t("passingScoreHint")}
                    min={0}
                    max={100}
                  />
                )}
              </form.Field>
            </div>
          </div>
        </SectionCard>

        {/* Questions */}
        <SectionCard
          title={t("questions")}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addQuestion}
              disabled={questions.length >= 50}
            >
              <Plus className="size-3.5" />
              {t("addQuestion")}
            </Button>
          }
        >
          <div className="space-y-4">
            {questions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                {t("noQuestionsHint")}
              </p>
            ) : (
              questions.map((q, idx) => (
                <QuestionBuilder
                  key={idx}
                  index={idx}
                  question={q}
                  onChange={(nq) => updateQuestion(idx, nq)}
                  onRemove={() => removeQuestion(idx)}
                />
              ))
            )}
          </div>
        </SectionCard>

        <FormErrorBanner message={error} />

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                {tCommon("back")}
              </Button>
              <SubmitButton
                pending={isSubmitting}
                disabled={!canSubmit}
                size="lg"
              >
                <Save className="size-4" />
                {tCommon("save")}
              </SubmitButton>
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}

/* -- Helpers ------------------------------------------------ */

const LEVELS = ["6e", "5e", "4e", "3e", "2nde", "1ere", "Tle"] as const;
const SERIES = ["A", "B", "C", "D", "E", "F", "G", "TI"] as const;

function makeEmptyQuestion(position: number): QuizQuestionInput {
  return {
    type: "single_choice",
    label: "",
    points: 1,
    explanation: undefined,
    difficulty: "medium" as (typeof DIFFICULTY_VALUES)[number],
    position,
    options: [
      { label: "", isCorrect: false, position: 0 },
      { label: "", isCorrect: false, position: 1 },
    ],
  };
}
