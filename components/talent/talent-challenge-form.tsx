"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, useSelector } from "@tanstack/react-form";
import { z } from "zod";
import { Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import {
  TextField,
  TextAreaField,
  NumberField,
  SelectField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  TALENT_CHALLENGE_TYPE_VALUES,
  type TalentChallengeTypeValue,
} from "@/server/db/schema/talent";
import { createTalentChallengeAction } from "@/server/actions/talent";
import { listSubjectSkillsAction } from "@/server/actions/subjects";
import type { Subject, SubjectSkill } from "@/server/db/schema/schools";
import type { TalentChallengeWithRelations } from "@/server/services/talent";

export interface TalentChallengeFormProps {
  subjects: Subject[];
  /** When provided, the form is in edit mode and prefilled. */
  initialChallenge?: TalentChallengeWithRelations;
}

const TALENT_TIERS = [
  "seedling",
  "bronze",
  "silver",
  "gold",
  "diamond",
] as const;
type TalentTier = (typeof TALENT_TIERS)[number];

const schema = z.object({
  subjectId: z
    .string()
    .min(1, "Subject is required")
    .uuid("Subject must be a valid id"),
  skillId: z
    .string()
    .min(1, "Skill is required")
    .uuid("Skill must be a valid id"),
  title: z
    .string()
    .min(3, "Title too short (min 3)")
    .max(200, "Title too long (max 200)"),
  description: z
    .string()
    .min(10, "Description too short (min 10)")
    .max(5000, "Description too long (max 5000)"),
  difficulty: z.number().int().min(1).max(10),
  estimatedMinutes: z.number().int().min(5).max(240),
  type: z.enum(TALENT_CHALLENGE_TYPE_VALUES),
  requiredTier: z.enum(TALENT_TIERS),
  solutionHint: z.string().max(2000).optional(),
  tags: z.string(), // comma-separated; parsed before submit
});

type FormValues = z.infer<typeof schema>;

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * Talent challenge create / edit form (§10.4).
 *
 * Subject dropdown is fed from props (server-fetched). The skill dropdown
 * is dynamic: when the subject changes, we refetch the skills via
 * `listSubjectSkillsAction`.
 *
 * On submit, we call `createTalentChallengeAction`. Update is not wired
 * up yet — when `initialChallenge` is set, an "update not available"
 * banner is shown above the form and the submit button is disabled.
 */
export function TalentChallengeForm({
  subjects,
  initialChallenge,
}: TalentChallengeFormProps) {
  const t = useTranslations("Talent");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const isEdit = Boolean(initialChallenge);

  const [serverError, setServerError] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<SubjectSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);

  const form = useForm({
    defaultValues: {
      subjectId: initialChallenge?.subjectId ?? "",
      skillId: initialChallenge?.skillId ?? "",
      title: initialChallenge?.title ?? "",
      description: initialChallenge?.description ?? "",
      difficulty: initialChallenge?.difficulty ?? 5,
      estimatedMinutes: initialChallenge?.estimatedMinutes ?? 30,
      type: (initialChallenge?.type ??
        "problem_set") as TalentChallengeTypeValue,
      requiredTier: (initialChallenge?.requiredTier ??
        "seedling") as TalentTier,
      solutionHint: initialChallenge?.solutionHint ?? "",
      tags: (initialChallenge?.tags ?? []).join(", "),
    } as FormValues,
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        // updateTalentChallengeAction does not exist yet — see task spec.
        setServerError(t("challengeEditNotImplementedDescription"));
        return;
      }
      setServerError(null);
      const result = await createTalentChallengeAction({
        subjectId: value.subjectId,
        skillId: value.skillId,
        title: value.title.trim(),
        description: value.description.trim(),
        difficulty: value.difficulty,
        estimatedMinutes: value.estimatedMinutes,
        type: value.type,
        requiredTier: value.requiredTier,
        solutionHint: value.solutionHint?.trim() || undefined,
        tags: parseTags(value.tags),
      });
      if (!result.success) {
        setServerError(result.error.message);
        return;
      }
      toast.success(t("challengeCreated"));
      router.push("/teacher/talent-challenges");
      router.refresh();
    },
  });

  // Watch subjectId to dynamically load its skills.
  const watchedSubjectId = useSelector(
    form.store,
    (state) => state.values.subjectId,
  );

  useEffect(() => {
    if (!watchedSubjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailableSkills([]);
      return;
    }
    let cancelled = false;
    setSkillsLoading(true);
    listSubjectSkillsAction({
      subjectId: watchedSubjectId,
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
  }, [watchedSubjectId]);

  const subjectOptions = subjects.map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const skillOptions = availableSkills.map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const typeOptions = TALENT_CHALLENGE_TYPE_VALUES.map((tp) => ({
    value: tp,
    label: t(`type.${tp}` as const),
  }));
  const tierOptions = TALENT_TIERS.map((tier) => ({
    value: tier,
    label: t(`tier.${tier}` as const),
  }));

  return (
    <SectionCard title={isEdit ? t("editChallenge") : t("newChallenge")}>
      {isEdit && (
        <Alert variant="warning" className="mb-5">
          <AlertCircle className="size-4" />
          <AlertTitle>{t("challengeEditNotImplementedTitle")}</AlertTitle>
          <AlertDescription>
            {t("challengeEditNotImplementedDescription")}
          </AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-5"
      >
        {/* Title */}
        <form.Field name="title">
          {(field) => (
            <TextField
              field={field}
              label={t("challengeTitle")}
              placeholder={t("challengeTitlePlaceholder")}
              required
              autoFocus
            />
          )}
        </form.Field>

        {/* Description */}
        <form.Field name="description">
          {(field) => (
            <TextAreaField
              field={field}
              label={t("challengeDescriptionField")}
              placeholder={t("challengeDescriptionPlaceholder")}
              required
              rows={5}
            />
          )}
        </form.Field>

        {/* Subject + Skill */}
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="subjectId">
            {(field) => (
              <SelectField
                field={field}
                label={t("challengeSubject")}
                placeholder={t("challengeSubjectPlaceholder")}
                required
                options={subjectOptions}
              />
            )}
          </form.Field>
          <form.Field name="skillId">
            {(field) => (
              <SelectField
                field={field}
                label={t("challengeSkill")}
                placeholder={
                  !watchedSubjectId
                    ? t("challengeSkillSelectSubjectFirst")
                    : skillsLoading
                      ? t("challengeSkillLoading")
                      : skillOptions.length === 0
                        ? t("challengeSkillEmpty")
                        : t("challengeSkillPlaceholder")
                }
                required
                disabled={!watchedSubjectId || skillsLoading}
                options={skillOptions}
              />
            )}
          </form.Field>
        </div>

        {/* Type + Required tier */}
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="type">
            {(field) => (
              <SelectField
                field={field}
                label={t("challengeType")}
                options={typeOptions}
              />
            )}
          </form.Field>
          <form.Field name="requiredTier">
            {(field) => (
              <SelectField
                field={field}
                label={t("challengeRequiredTier")}
                options={tierOptions}
              />
            )}
          </form.Field>
        </div>

        {/* Difficulty + Estimated minutes */}
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="difficulty">
            {(field) => (
              <NumberField
                field={field}
                label={t("challengeDifficulty")}
                description={t("challengeDifficultyHint")}
                required
                min={1}
                max={10}
              />
            )}
          </form.Field>
          <form.Field name="estimatedMinutes">
            {(field) => (
              <NumberField
                field={field}
                label={t("challengeEstimatedMinutes")}
                required
                min={5}
                max={240}
              />
            )}
          </form.Field>
        </div>

        {/* Solution hint */}
        <form.Field name="solutionHint">
          {(field) => (
            <TextAreaField
              field={field}
              label={
                <>
                  {t("challengeSolutionHint")}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({tCommon("optional")})
                  </span>
                </>
              }
              placeholder={t("challengeSolutionHintPlaceholder")}
              rows={3}
            />
          )}
        </form.Field>

        {/* Tags */}
        <form.Field name="tags">
          {(field) => (
            <TextField
              field={field}
              label={
                <>
                  {t("challengeTags")}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({tCommon("optional")})
                  </span>
                </>
              }
              placeholder={t("challengeTagsPlaceholder")}
              description={t("challengeTagsHint")}
            />
          )}
        </form.Field>

        {serverError && <FormErrorBanner message={serverError} />}

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                {tCommon("cancel")}
              </Button>
              <SubmitButton
                pending={isSubmitting}
                disabled={!canSubmit || isEdit}
                variant="brand"
                size="lg"
              >
                <Save className="size-4" />
                {isEdit ? tCommon("save") : tCommon("create")}
              </SubmitButton>
            </div>
          )}
        </form.Subscribe>
      </form>
    </SectionCard>
  );
}
