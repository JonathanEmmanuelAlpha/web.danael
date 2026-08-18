"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  BookOpen,
  Edit,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Target,
  GripVertical,
  CircleDot,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SelectField,
  TextField,
  TextAreaField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import {
  listSubjectsWithSkillsAction,
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
  createSubjectSkillAction,
  updateSubjectSkillAction,
  deleteSubjectSkillAction,
} from "@/server/actions/subjects";
import {
  SKILL_DIFFICULTY_VALUES,
  type SkillDifficultyValue,
} from "@/server/validators/subjects";
import type { Subject, SubjectSkill } from "@/server/db/schema/schools";
import type { SubjectWithSkills } from "@/server/services/subjects";

/* ────────────────────────────────────────────────────────────────
 * Schemas
 * ──────────────────────────────────────────────────────────────── */

const subjectSchema = z.object({
  name: z.string().min(2, "Au moins 2 caractères"),
  code: z
    .string()
    .min(2, "Au moins 2 caractères")
    .max(20, "Max 20 caractères")
    .regex(/^[A-Z0-9_-]+$/i, "Lettres, chiffres, _ et - uniquement"),
  description: z.string().optional(),
});

type SubjectFormValues = z.infer<typeof subjectSchema>;

const skillSchema = z.object({
  name: z.string().min(2, "Au moins 2 caractères"),
  description: z.string().optional(),
  difficulty: z.enum(SKILL_DIFFICULTY_VALUES),
});

type SkillFormValues = z.infer<typeof skillSchema>;

/* ────────────────────────────────────────────────────────────────
 * Difficulty helpers
 * ──────────────────────────────────────────────────────────────── */

const DIFFICULTY_META: Record<
  SkillDifficultyValue,
  { color: string; ring: string; label: string }
> = {
  easy: {
    color: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
    label: "Facile",
  },
  medium: {
    color: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
    ring: "ring-amber-500/30",
    label: "Moyen",
  },
  advanced: {
    color: "text-orange-600 bg-orange-500/10 dark:text-orange-400",
    ring: "ring-orange-500/30",
    label: "Avancé",
  },
  hard: {
    color: "text-rose-600 bg-rose-500/10 dark:text-rose-400",
    ring: "ring-rose-500/30",
    label: "Difficile",
  },
};

function difficultyClasses(d: string): string {
  return (
    DIFFICULTY_META[d as SkillDifficultyValue]?.color ??
    "text-muted-foreground bg-muted"
  );
}

function difficultyLabel(d: string): string {
  return DIFFICULTY_META[d as SkillDifficultyValue]?.label ?? d;
}

/* ────────────────────────────────────────────────────────────────
 * Main component
 * ──────────────────────────────────────────────────────────────── */

interface SubjectsManagerProps {
  schoolScoped?: boolean;
}

/**
 * Subject catalog CRUD manager with detailed cards.
 *
 * Each subject card shows:
 *  - Subject name, code, description
 *  - Total number of skills
 *  - A grid (grid-cols-1 lg:grid-cols-2) of all associated skills
 *  - Each skill has edit + delete buttons
 *  - An "Add skill" button that opens a dialog (name + difficulty)
 *
 * Used by /admin/subjects and /school/subjects.
 */
export function SubjectsManager({ schoolScoped = false }: SubjectsManagerProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  const [subjects, setSubjects] = useState<SubjectWithSkills[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    let cancelled = false;
    listSubjectsWithSkillsAction().then((res) => {
      if (cancelled) return;
      setSubjects(res.success ? res.data : []);
      // Auto-expand subjects that have skills for better discoverability.
      if (res.success) {
        setExpandedIds(
          new Set(res.data.filter((s) => s.skills.length > 0).map((s) => s.id)),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return load();
  }, [load]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSkillCreated(subjectId: string, skill: SubjectSkill) {
    setSubjects((prev) =>
      prev?.map((s) =>
        s.id === subjectId
          ? { ...s, skills: [...s.skills, skill], skillsCount: s.skillsCount + 1 }
          : s,
      ) ?? null,
    );
    setExpandedIds((prev) => new Set(prev).add(subjectId));
  }

  function handleSkillUpdated(subjectId: string, updated: SubjectSkill) {
    setSubjects((prev) =>
      prev?.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              skills: s.skills.map((k) => (k.id === updated.id ? updated : k)),
            }
          : s,
      ) ?? null,
    );
  }

  async function handleSkillDeleted(subjectId: string, skillId: string) {
    setDeleting(skillId);
    const res = await deleteSubjectSkillAction(skillId);
    setDeleting(null);
    if (!res.success) {
      toast.error(res.error?.message ?? t("skillDeleteFailed"));
      return;
    }
    toast.success(t("skillDeleted"));
    setSubjects((prev) =>
      prev?.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              skills: s.skills.filter((k) => k.id !== skillId),
              skillsCount: Math.max(0, s.skillsCount - 1),
            }
          : s,
      ) ?? null,
    );
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await deleteSubjectAction(id);
    setDeleting(null);
    if (!res.success) {
      toast.error(res.error?.message ?? t("subjectsDeleteFailed"));
      return;
    }
    toast.success(t("subjectsDeleted"));
    setSubjects((prev) => prev?.filter((s) => s.id !== id) ?? null);
  }

  if (subjects === null) {
    return (
      <div className="gap-4 grid grid-cols-1 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {schoolScoped ? t("subjectsSchoolHint") : t("subjectsPlatformHint")}
        </p>
        <CreateSubjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(s) => {
            setSubjects((prev) => [
              ...(prev ?? []),
              { ...s, skills: [], skillsCount: 0 },
            ]);
          }}
        />
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("subjectsEmpty")}
          description={t("subjectsEmptyHint")}
        />
      ) : (
        <div className="gap-4 grid grid-cols-1 lg:grid-cols-2">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              expanded={expandedIds.has(subject.id)}
              onToggle={() => toggleExpanded(subject.id)}
              onSubjectUpdated={(updated) => {
                setSubjects(
                  (prev) =>
                    prev?.map((s) =>
                      s.id === updated.id ? { ...s, ...updated } : s,
                    ) ?? null,
                );
              }}
              onSkillCreated={(skill) => handleSkillCreated(subject.id, skill)}
              onSkillUpdated={(skill) => handleSkillUpdated(subject.id, skill)}
              onSkillDeleted={(skillId) =>
                handleSkillDeleted(subject.id, skillId)
              }
              deletingSkillId={deleting}
              onDeleteSubject={() => handleDelete(subject.id)}
              isDeletingSubject={deleting === subject.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Subject card — detailed, collapsible, with skills grid
 * ──────────────────────────────────────────────────────────────── */

interface SubjectCardProps {
  subject: SubjectWithSkills;
  expanded: boolean;
  onToggle: () => void;
  onSubjectUpdated: (s: Subject) => void;
  onSkillCreated: (s: SubjectSkill) => void;
  onSkillUpdated: (s: SubjectSkill) => void;
  onSkillDeleted: (skillId: string) => void;
  deletingSkillId: string | null;
  onDeleteSubject: () => void;
  isDeletingSubject: boolean;
}

function SubjectCard({
  subject,
  expanded,
  onToggle,
  onSubjectUpdated,
  onSkillCreated,
  onSkillUpdated,
  onSkillDeleted,
  deletingSkillId,
  onDeleteSubject,
  isDeletingSubject,
}: SubjectCardProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  return (
    <Collapsible
      open={expanded}
      onOpenChange={onToggle}
      className="group rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary-500/30"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/15 to-primary-500/5 text-primary-600 dark:text-primary-400">
          <BookOpen className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-foreground">
              {subject.name}
            </h3>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {subject.code}
            </Badge>
          </div>
          {subject.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {subject.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground italic">
              {t("noDescription")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="gap-1 bg-primary-500/10 text-primary-700 dark:text-primary-300"
            >
              <Sparkles className="size-3" />
              {subject.skillsCount}{" "}
              {subject.skillsCount === 1 ? t("skill") : t("skills")}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <EditSubjectDialog
            subject={subject}
            onUpdated={onSubjectUpdated}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-accent-coral-400 hover:bg-accent-coral-500/10 hover:text-accent-coral-300"
                disabled={isDeletingSubject}
                aria-label={tCommon("delete")}
              >
                {isDeletingSubject ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("subjectsDeleteConfirm")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("subjectsDeleteWarning")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDeleteSubject}
                  className="bg-accent-coral-500 hover:bg-accent-coral-600"
                >
                  {tCommon("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Toggle button */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronDown className="size-3.5" />
              {t("collapseSkills")}
            </>
          ) : (
            <>
              <ChevronRight className="size-3.5" />
              {t("showSkills", { count: subject.skillsCount })}
            </>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-border bg-muted/20 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary-600 dark:text-primary-400" />
              <h4 className="text-sm font-semibold text-foreground">
                {t("skillsList")}
              </h4>
            </div>
            <CreateSkillDialog
              subjectId={subject.id}
              onCreated={onSkillCreated}
            />
          </div>

          {subject.skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/50 py-8 text-center">
              <CircleDot className="size-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t("noSkillsYet")}</p>
              <CreateSkillDialog
                subjectId={subject.id}
                onCreated={onSkillCreated}
                triggerVariant="outline"
              />
            </div>
          ) : (
            <div className="gap-3 grid grid-cols-1 lg:grid-cols-2">
              {subject.skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onUpdated={onSkillUpdated}
                  onDelete={() => onSkillDeleted(skill.id)}
                  isDeleting={deletingSkillId === skill.id}
                />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Skill card — single skill row with edit/delete
 * ──────────────────────────────────────────────────────────────── */

interface SkillCardProps {
  skill: SubjectSkill;
  onUpdated: (s: SubjectSkill) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function SkillCard({ skill, onUpdated, onDelete, isDeleting }: SkillCardProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  return (
    <div className="group/skill relative flex items-start gap-2.5 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary-500/30 hover:bg-muted/20">
      <div className="mt-0.5 text-muted-foreground/60">
        <GripVertical className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">
            {skill.name}
          </p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${difficultyClasses(
              skill.difficulty,
            )}`}
          >
            {difficultyLabel(skill.difficulty)}
          </span>
        </div>
        {skill.description ? (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {skill.description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/skill:opacity-100">
        <EditSkillDialog skill={skill} onUpdated={onUpdated} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-accent-coral-400 hover:bg-accent-coral-500/10 hover:text-accent-coral-300"
              disabled={isDeleting}
              aria-label={tCommon("delete")}
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("skillDeleteConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("skillDeleteWarning")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-accent-coral-500 hover:bg-accent-coral-600"
              >
                {tCommon("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Create subject dialog
 * ──────────────────────────────────────────────────────────────── */

function CreateSubjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (subject: Subject) => void;
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  const form = useForm({
    defaultValues: {
      name: "",
      code: "",
      description: "",
    } as SubjectFormValues,
    validators: { onChange: subjectSchema },
    onSubmit: async ({ value }) => {
      const res = await createSubjectAction({
        name: value.name.trim(),
        code: value.code.toUpperCase().trim(),
        description: value.description?.trim() || undefined,
      });
      if (!res.success) {
        toast.error(res.error?.message ?? t("subjectsCreateFailed"));
        return;
      }
      toast.success(t("subjectsCreated"));
      onCreated(res.data);
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Plus className="size-4" />
          {t("subjectsCreate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("subjectsCreateTitle")}</DialogTitle>
          <DialogDescription>
            {t("subjectsCreateDescription")}
          </DialogDescription>
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
                label={t("subjectsName")}
                placeholder="Mathématiques"
                required
              />
            )}
          </form.Field>
          <form.Field name="code">
            {(field) => (
              <TextField
                field={field}
                label={t("subjectsCode")}
                placeholder="MATHS"
                description={t("subjectsCodeHint")}
                required
              />
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <TextAreaField
                field={field}
                label={t("subjectsDescriptionField")}
                placeholder={t("subjectsDescriptionPlaceholder")}
                rows={3}
              />
            )}
          </form.Field>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting] as const
              }
            >
              {([canSubmit, isSubmitting]) => (
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  {t("subjectsCreate")}
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Edit subject dialog
 * ──────────────────────────────────────────────────────────────── */

function EditSubjectDialog({
  subject,
  onUpdated,
}: {
  subject: Subject;
  onUpdated: (subject: Subject) => void;
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: subject.name,
      code: subject.code,
      description: subject.description ?? "",
    } as SubjectFormValues,
    validators: { onChange: subjectSchema },
    onSubmit: async ({ value }) => {
      const res = await updateSubjectAction({
        id: subject.id,
        name: value.name.trim(),
        code: value.code.toUpperCase().trim(),
        description: value.description?.trim() || undefined,
      });
      if (!res.success) {
        toast.error(res.error?.message ?? t("subjectsUpdateFailed"));
        return;
      }
      toast.success(t("subjectsUpdated"));
      onUpdated(res.data);
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={tCommon("edit")}>
          <Edit className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("subjectsEditTitle")}</DialogTitle>
          <DialogDescription>{t("subjectsEditDescription")}</DialogDescription>
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
              <TextField field={field} label={t("subjectsName")} required />
            )}
          </form.Field>
          <form.Field name="code">
            {(field) => (
              <TextField
                field={field}
                label={t("subjectsCode")}
                description={t("subjectsCodeHint")}
                required
              />
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <TextAreaField
                field={field}
                label={t("subjectsDescriptionField")}
                rows={3}
              />
            )}
          </form.Field>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting] as const
              }
            >
              {([canSubmit, isSubmitting]) => (
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  {tCommon("save")}
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Create skill dialog
 * ──────────────────────────────────────────────────────────────── */

function CreateSkillDialog({
  subjectId,
  onCreated,
  triggerVariant = "brand",
}: {
  subjectId: string;
  onCreated: (skill: SubjectSkill) => void;
  triggerVariant?: "brand" | "outline";
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      difficulty: "medium" as SkillDifficultyValue,
    } as SkillFormValues,
    validators: { onChange: skillSchema },
    onSubmit: async ({ value }) => {
      const res = await createSubjectSkillAction({
        subjectId,
        name: value.name.trim(),
        description: value.description?.trim() || undefined,
        difficulty: value.difficulty,
      });
      if (!res.success) {
        toast.error(res.error?.message ?? t("skillCreateFailed"));
        return;
      }
      toast.success(t("skillCreated"));
      onCreated(res.data);
      setOpen(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <Plus className="size-4" />
          {t("skillCreate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("skillCreateTitle")}</DialogTitle>
          <DialogDescription>{t("skillCreateDescription")}</DialogDescription>
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
                label={t("skillName")}
                placeholder={t("skillNamePlaceholder")}
                required
                autoFocus
              />
            )}
          </form.Field>
          <form.Field name="difficulty">
            {(field) => (
              <SelectField
                field={field}
                label={t("skillDifficulty")}
                description={t("skillDifficultyHint")}
                options={SKILL_DIFFICULTY_VALUES.map((d) => ({
                  value: d,
                  label: difficultyLabel(d),
                }))}
              />
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <TextAreaField
                field={field}
                label={
                  <>
                    {t("skillDescriptionField")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                placeholder={t("skillDescriptionPlaceholder")}
                rows={3}
              />
            )}
          </form.Field>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting] as const
              }
            >
              {([canSubmit, isSubmitting]) => (
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  {tCommon("create")}
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Edit skill dialog
 * ──────────────────────────────────────────────────────────────── */

function EditSkillDialog({
  skill,
  onUpdated,
}: {
  skill: SubjectSkill;
  onUpdated: (skill: SubjectSkill) => void;
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: skill.name,
      description: skill.description ?? "",
      difficulty: skill.difficulty as SkillDifficultyValue,
    } as SkillFormValues,
    validators: { onChange: skillSchema },
    onSubmit: async ({ value }) => {
      const res = await updateSubjectSkillAction({
        id: skill.id,
        name: value.name.trim(),
        description: value.description?.trim() || null,
        difficulty: value.difficulty,
      });
      if (!res.success) {
        toast.error(res.error?.message ?? t("skillUpdateFailed"));
        return;
      }
      toast.success(t("skillUpdated"));
      onUpdated(res.data);
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={tCommon("edit")}
        >
          <Edit className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("skillEditTitle")}</DialogTitle>
          <DialogDescription>{t("skillEditDescription")}</DialogDescription>
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
                label={t("skillName")}
                required
                autoFocus
              />
            )}
          </form.Field>
          <form.Field name="difficulty">
            {(field) => (
              <SelectField
                field={field}
                label={t("skillDifficulty")}
                options={SKILL_DIFFICULTY_VALUES.map((d) => ({
                  value: d,
                  label: difficultyLabel(d),
                }))}
              />
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <TextAreaField
                field={field}
                label={
                  <>
                    {t("skillDescriptionField")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </>
                }
                rows={3}
              />
            )}
          </form.Field>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting] as const
              }
            >
              {([canSubmit, isSubmitting]) => (
                <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                  {tCommon("save")}
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
