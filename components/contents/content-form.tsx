"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { SectionCard } from "@/components/shared/section-card";
import {
  FileUploader,
  type UploadedFile,
} from "@/components/forms/file-uploader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  TextField,
  TextAreaField,
  NumberField,
  SelectField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import {
  CONTENT_TYPE_VALUES,
  CONTENT_VISIBILITY_VALUES,
  PUBLICATION_STATUS_VALUES,
  LEVEL_VALUES,
  SERIES_VALUES,
  DIFFICULTY_VALUES,
} from "@/server/db/schema/enums";
import type { Subject } from "@/server/db/schema/schools";
import type { ContentWithRelations } from "@/server/services/contents";
import {
  createContentAction,
  updateContentAction,
} from "@/server/actions/contents";

export interface ContentFormProps {
  subjects: Subject[];
  /** When provided, the form is in edit mode. */
  initialContent?: ContentWithRelations;
  /** Optional schoolId to preset (e.g. school_admin context). */
  defaultSchoolId?: string;
}

const contentSchema = z.object({
  type: z.string().min(1),
  title: z.string().refine((v) => v.trim().length > 0, "Title is required"),
  description: z.string().max(2000),
  subjectId: z.string(),
  level: z.string(),
  series: z.string(),
  visibility: z.string().min(1),
  publicationStatus: z.string().min(1),
  difficulty: z.string(),
  durationMinutes: z.number().int().min(0).max(1440).optional(),
  year: z.number().int().min(1990).max(2100).optional(),
  tags: z.string(),
  skills: z.string(),
  fileId: z.string().nullable(),
  thumbnailFileId: z.string().nullable(),
});

type ContentFormValues = z.infer<typeof contentSchema>;

function parseList(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Create / edit content form.
 *
 * - Uses the FileUploader component to upload the main file (PDF, video…).
 * - Tags/skills are entered as comma-separated lists and converted to arrays.
 * - All inputs are validated by the Zod schema (client) + server action.
 */
export function ContentForm({
  subjects,
  initialContent,
  defaultSchoolId,
}: ContentFormProps) {
  const t = useTranslations("Contents");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const isEdit = Boolean(initialContent);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      type: initialContent?.type ?? "epreuve",
      title: initialContent?.title ?? "",
      description: initialContent?.description ?? "",
      subjectId: initialContent?.subjectId ?? "",
      level: initialContent?.level ?? "",
      series: initialContent?.series ?? "",
      visibility: initialContent?.visibility ?? "public",
      publicationStatus: initialContent?.publicationStatus ?? "draft",
      difficulty: initialContent?.difficulty ?? "",
      durationMinutes: initialContent?.durationMinutes ?? undefined,
      year: initialContent?.year ?? undefined,
      tags: (initialContent?.tags ?? []).join(", "),
      skills: (initialContent?.skills ?? []).join(", "),
      fileId: initialContent?.fileId ?? null,
      thumbnailFileId: initialContent?.thumbnailFileId ?? null,
    } as ContentFormValues,
    validators: {
      onChange: contentSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const payload = {
        type: value.type as (typeof CONTENT_TYPE_VALUES)[number],
        title: value.title.trim(),
        description: value.description.trim() || undefined,
        subjectId: value.subjectId || undefined,
        level: (value.level || undefined) as
          | (typeof LEVEL_VALUES)[number]
          | undefined,
        series: (value.series || undefined) as
          | (typeof SERIES_VALUES)[number]
          | undefined,
        schoolId: defaultSchoolId ?? undefined,
        visibility:
          value.visibility as (typeof CONTENT_VISIBILITY_VALUES)[number],
        publicationStatus:
          value.publicationStatus as (typeof PUBLICATION_STATUS_VALUES)[number],
        difficulty: (value.difficulty || undefined) as
          | (typeof DIFFICULTY_VALUES)[number]
          | undefined,
        durationMinutes: value.durationMinutes,
        year: value.year,
        tags: parseList(value.tags),
        skills: parseList(value.skills),
        fileId: value.fileId ?? undefined,
      };

      const result =
        isEdit && initialContent
          ? await updateContentAction({ id: initialContent.id, ...payload })
          : await createContentAction(payload);

      if (!result.success) {
        setServerError(result.error.message);
        return;
      }
      toast.success(isEdit ? t("contentUpdated") : t("contentCreated"));
      router.push("/teacher-contents");
      router.refresh();
    },
  });

  return (
    <SectionCard title={isEdit ? t("editContent") : t("newContent")}>
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
              label={t("title")}
              placeholder={t("titlePlaceholder")}
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
              label={
                <>
                  {t("description")}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({tCommon("optional")})
                  </span>
                </>
              }
              placeholder={t("descriptionPlaceholder")}
              rows={4}
            />
          )}
        </form.Field>

        {/* Type + Visibility + Status */}
        <div className="grid gap-4 sm:grid-cols-3">
          <form.Field name="type">
            {(field) => (
              <SelectField
                field={field}
                label={t("type")}
                options={CONTENT_TYPE_VALUES.map((tp) => ({
                  value: tp,
                  label: t(`types.${tp}` as const),
                }))}
              />
            )}
          </form.Field>
          <form.Field name="visibility">
            {(field) => (
              <SelectField
                field={field}
                label={t("visibility")}
                options={CONTENT_VISIBILITY_VALUES.map((v) => ({
                  value: v,
                  label: t(`visibility.${v}` as const),
                }))}
              />
            )}
          </form.Field>
          <form.Field name="publicationStatus">
            {(field) => (
              <SelectField
                field={field}
                label={t("status")}
                options={PUBLICATION_STATUS_VALUES.map((s) => ({
                  value: s,
                  label: t(`status.${s}` as const),
                }))}
              />
            )}
          </form.Field>
        </div>

        {/* Subject + Level + Series */}
        <div className="grid gap-4 sm:grid-cols-3">
          <form.Field name="subjectId">
            {(field) => (
              <SelectField
                field={field}
                label={
                  <>
                    {t("subject")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={t("subjectPlaceholder")}
                options={subjects.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
              />
            )}
          </form.Field>
          <form.Field name="level">
            {(field) => (
              <SelectField
                field={field}
                label={
                  <>
                    {t("level")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={tCommon("none")}
                options={LEVEL_VALUES.map((lv) => ({
                  value: lv,
                  label: lv,
                }))}
              />
            )}
          </form.Field>
          <form.Field name="series">
            {(field) => (
              <SelectField
                field={field}
                label={
                  <>
                    {t("series")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={tCommon("none")}
                options={SERIES_VALUES.map((s) => ({
                  value: s,
                  label: s,
                }))}
              />
            )}
          </form.Field>
        </div>

        {/* Difficulty + Duration + Year */}
        <div className="grid gap-4 sm:grid-cols-3">
          <form.Field name="difficulty">
            {(field) => (
              <SelectField
                field={field}
                label={
                  <>
                    {t("difficultyLabel")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={tCommon("none")}
                options={DIFFICULTY_VALUES.map((d) => ({
                  value: d,
                  label: t(`difficulty.${d}` as const),
                }))}
              />
            )}
          </form.Field>
          <form.Field name="durationMinutes">
            {(field) => (
              <NumberField
                field={field}
                label={
                  <>
                    {t("duration")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder="60"
                min={0}
                max={1440}
              />
            )}
          </form.Field>
          <form.Field name="year">
            {(field) => (
              <NumberField
                field={field}
                label={
                  <>
                    {t("year")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={String(new Date().getFullYear())}
                min={1990}
                max={2100}
              />
            )}
          </form.Field>
        </div>

        {/* Tags + Skills */}
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="tags">
            {(field) => (
              <TextField
                field={field}
                label={
                  <>
                    {t("tags")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={t("tagsPlaceholder")}
              />
            )}
          </form.Field>
          <form.Field name="skills">
            {(field) => (
              <TextField
                field={field}
                label={
                  <>
                    {t("skills")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={t("skillsPlaceholder")}
              />
            )}
          </form.Field>
        </div>

        {/* File uploader */}
        <div className="space-y-2">
          <Label>{t("file")}</Label>
          <FileUploader
            accept="application/pdf,image/*,video/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            maxSizeBytes={256 * 1024 * 1024}
            category="content"
            hint={t("fileHint")}
            onUploaded={(file: UploadedFile) => {
              if (file.id) form.setFieldValue("fileId", file.id);
            }}
          />
          <form.Subscribe selector={(state) => state.values.fileId}>
            {(fileId) =>
              fileId ? (
                <p className="text-xs text-success">{t("fileLinked")}</p>
              ) : null
            }
          </form.Subscribe>
        </div>

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
                disabled={!canSubmit}
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
