"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2, X, Link as LinkIcon, Type, FileText } from "lucide-react";
import { useForm, useSelector } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TextField,
  TextAreaField,
  SelectField,
  DateField,
  NumberField,
  SwitchField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import {
  createAssignmentAction,
  updateAssignmentAction,
} from "@/server/actions/assignments";
import { listClassesAction } from "@/server/actions/classes";
import {
  listSubjectsAction,
  listSubjectSkillsAction,
} from "@/server/actions/subjects";
import type { ClassWithRelations } from "@/server/services/classes";
import type { Subject, SubjectSkill } from "@/server/db/schema/schools";
import type { AssignmentWithRelations } from "@/server/services/assignments";

interface AssignmentFormProps {
  /** When editing, pass the existing assignment. */
  assignment?: AssignmentWithRelations;
  /** Pre-select a class (e.g. when navigating from a class page). */
  defaultClassId?: string;
  /** Called after a successful create/update. */
  onSuccess?: (assignment: AssignmentWithRelations) => void;
  /** Cancel handler. */
  onCancel?: () => void;
}

type ItemType = "content" | "url" | "text";

interface ItemDraft {
  key: string;
  type: ItemType;
  url?: string;
  text?: string;
  contentId?: string;
}

const assignmentSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().max(5000).optional().or(z.literal("")),
  classId: z.string().min(1, "La classe est requise"),
  subjectId: z.string(),
  skillId: z.string().optional(),
  dueAt: z.date().nullable().optional(),
  points: z.number().min(0).max(1000).optional(),
  allowLate: z.boolean(),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

/**
 * §5.5 — Create / edit assignment form.
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn wrappers for scalar fields.
 * The dynamic `items[]` array stays in useState (it has its own per-row UI).
 *
 * Fields:
 *  - title (required)
 *  - description
 *  - class (required)
 *  - subject (optional)
 *  - dueAt (date)
 *  - points (number)
 *  - allowLateSubmission (switch)
 *  - items[] (file/url/text)
 */
export function AssignmentForm({
  assignment,
  defaultClassId,
  onSuccess,
  onCancel,
}: AssignmentFormProps) {
  const t = useTranslations("Assignments");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const isEditing = !!assignment;

  const [classes, setClasses] = useState<ClassWithRelations[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SubjectSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>(
    assignment?.items.map((it) => ({
      key: it.id,
      type: (it.type === "url" || it.type === "text" || it.type === "content"
        ? it.type
        : "content") as ItemType,
      url: it.type === "url" ? (it.url ?? "") : undefined,
      text: it.type === "text" ? (it.url ?? "") : undefined,
    })) ?? [],
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listClassesAction({ page: 1, pageSize: 100 }).then((res) => {
      if (res.success) setClasses(res.data.items);
      else setClasses([]);
    });
    listSubjectsAction().then((res) => {
      if (res.success) setSubjects(res.data);
    });
  }, []);

  function addItem(type: ItemType) {
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        type,
        url: "",
        text: "",
      },
    ]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    );
  }

  const form = useForm({
    defaultValues: {
      title: assignment?.title ?? "",
      description: assignment?.description ?? "",
      classId: assignment?.classId ?? defaultClassId ?? "",
      subjectId: assignment?.subjectId ?? "none",
      skillId: assignment?.skillId ?? "",
      dueAt: assignment?.dueAt ? new Date(assignment.dueAt) : null,
      points: assignment?.points ?? 20,
      allowLate: assignment?.allowLateSubmission ?? false,
    } as AssignmentFormValues,
    validators: {
      onChange: assignmentSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      // Validate dynamic items (not part of the TanStack schema).
      for (const item of items) {
        if (item.type === "url" && !item.url?.trim()) {
          setFormError(t("formErrors.urlRequired"));
          return;
        }
        if (item.type === "text" && !item.text?.trim()) {
          setFormError(t("formErrors.textRequired"));
          return;
        }
      }

      const dueAtIso = value.dueAt
        ? new Date(value.dueAt).toISOString()
        : undefined;
      const payload = {
        title: value.title.trim(),
        description: value.description?.trim() || undefined,
        classId: value.classId,
        subjectId: value.subjectId === "none" ? undefined : value.subjectId,
        skillId: value.skillId || undefined,
        dueAt: dueAtIso,
        points: value.points,
        allowLateSubmission: value.allowLate,
        items: items.map((it, idx) => ({
          type: it.type,
          url: it.type === "url" ? it.url : undefined,
          text: it.type === "text" ? it.text : undefined,
          contentId: it.contentId,
          position: idx,
        })),
      };

      if (isEditing && assignment) {
        const res = await updateAssignmentAction({
          id: assignment.id,
          title: payload.title,
          description: payload.description ?? null,
          classId: payload.classId,
          subjectId: payload.subjectId ?? null,
          skillId: payload.skillId ?? null,
          dueAt: payload.dueAt ?? null,
          points: payload.points ?? null,
          allowLateSubmission: payload.allowLateSubmission,
        });
        if (!res.success) {
          toast.error(res.error.message ?? t("edit"));
          return;
        }
        toast.success(t("assignmentUpdated"));
        onSuccess?.(res.data);
        router.refresh();
        return;
      }

      const res = await createAssignmentAction({
        ...payload,
        teacherId: "", // overridden by the action
        status: "draft",
      });
      if (!res.success) {
        toast.error(res.error.message ?? t("create"));
        return;
      }
      toast.success(t("assignmentCreated"));
      onSuccess?.(res.data);
      router.push(`/assignments/${res.data.id}`);
    },
  });

  // Watch subjectId to dynamically load its skills.
  const watchedSubjectId = useSelector(
    form.store,
    (state) => state.values.subjectId,
  );
  const hasSubject = !!watchedSubjectId && watchedSubjectId !== "none";

  useEffect(() => {
    if (!hasSubject) {
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
  }, [watchedSubjectId, hasSubject]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-6"
    >
      {/* Title */}
      <form.Field name="title">
        {(field) => (
          <TextField
            field={field}
            label={t("title")}
            placeholder={t("title")}
            required
            autoFocus
            inputClassName="h-12"
          />
        )}
      </form.Field>

      {/* Description */}
      <form.Field name="description">
        {(field) => (
          <TextAreaField
            field={field}
            label={t("description")}
            placeholder={t("description")}
            rows={4}
          />
        )}
      </form.Field>

      {/* Class + Subject + Skill */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {classes === null ? (
          <div className="space-y-2">
            <Label>{t("className")}</Label>
            <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ) : (
          <form.Field name="classId">
            {(field) => (
              <SelectField
                field={field}
                label={t("className")}
                placeholder={t("chooseClass")}
                required
                options={classes.map((cls) => ({
                  value: cls.id,
                  label: `${cls.name}${cls.academicYear ? ` · ${cls.academicYear}` : ""}`,
                }))}
              />
            )}
          </form.Field>
        )}

        <form.Field name="subjectId">
          {(field) => (
            <SelectField
              field={field}
              label={t("subject")}
              placeholder={t("chooseSubject")}
              options={[
                { value: "none", label: tCommon("none") },
                ...subjects.map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.code ? ` (${s.code})` : ""}`,
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
      </div>

      {/* DueAt + Points */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.Field name="dueAt">
          {(field) => <DateField field={field} label={t("dueDate")} />}
        </form.Field>
        <form.Field name="points">
          {(field) => (
            <NumberField field={field} label={t("points")} min={0} max={1000} />
          )}
        </form.Field>
      </div>

      {/* Allow late */}
      <form.Field name="allowLate">
        {(field) => (
          <SwitchField
            field={field}
            label={t("allowLate")}
            description={t("allowLateHint")}
            className="rounded-xl border border-border bg-muted/30 px-4 py-3"
          />
        )}
      </form.Field>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">{t("items")}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("itemsHint")}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addItem("url")}
            >
              <LinkIcon className="size-3.5" />
              {t("addLink")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addItem("text")}
            >
              <Type className="size-3.5" />
              {t("addText")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addItem("content")}
            >
              <FileText className="size-3.5" />
              {t("addItem")}
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
            {t("noItems")}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li
                key={item.key}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    #{idx + 1} ·{" "}
                    {item.type === "url"
                      ? t("itemTypeUrl")
                      : item.type === "text"
                        ? t("itemTypeText")
                        : t("itemTypeContent")}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-7"
                    onClick={() => removeItem(item.key)}
                    aria-label={t("removeItem")}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {item.type === "url" ? (
                  <Input
                    className="mt-2"
                    placeholder="https://…"
                    value={item.url ?? ""}
                    onChange={(e) =>
                      updateItem(item.key, { url: e.target.value })
                    }
                  />
                ) : item.type === "text" ? (
                  <Textarea
                    className="mt-2"
                    rows={3}
                    placeholder={t("itemText")}
                    value={item.text ?? ""}
                    onChange={(e) =>
                      updateItem(item.key, { text: e.target.value })
                    }
                  />
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("itemTypeContent")} — {t("noItemsHint")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

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
            <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
              {isEditing ? tCommon("save") : tCommon("create")}
            </SubmitButton>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
