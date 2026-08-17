"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { BookOpen, Edit, Plus, Trash2, Loader2 } from "lucide-react";

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
  TextField,
  TextAreaField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";

import {
  listSubjectsAction,
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
} from "@/server/actions/subjects";
import type { Subject } from "@/server/db/schema/schools";

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

interface SubjectsManagerProps {
  /** Restrict to school context (school_admin). If false, platform-wide (admin). */
  schoolScoped?: boolean;
}

/**
 * Subject catalog CRUD manager.
 *
 * Used by:
 *  - /admin/subjects (platform_admin) — global catalog
 *  - /school/subjects (school_admin) — same global catalog (subjects are shared)
 *
 * Features:
 *  - List subjects with code + description
 *  - Create new subject (name + code + description)
 *  - Edit existing subject
 *  - Delete subject (with confirmation dialog; warns if subject is in use)
 */
export function SubjectsManager({
  schoolScoped = false,
}: SubjectsManagerProps) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");

  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    listSubjectsAction().then((res) => {
      if (cancelled) return;
      setSubjects(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return load();
  }, [load]);

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
      <div className="gap-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {schoolScoped ? t("subjectsSchoolHint") : t("subjectsPlatformHint")}
        </p>
        <CreateSubjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(s) => {
            setSubjects((prev) => [...(prev ?? []), s]);
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
        <div className="gap-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => (
            <Card
              key={subject.id}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30 bg-surface-2"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400">
                <BookOpen className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{subject.name}</p>
                  <Badge variant="outline" className="font-mono text-xs">
                    {subject.code}
                  </Badge>
                </div>
                {subject.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {subject.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <EditSubjectDialog
                  subject={subject}
                  onUpdated={(updated) => {
                    setSubjects(
                      (prev) =>
                        prev?.map((s) => (s.id === updated.id ? updated : s)) ??
                        null,
                    );
                  }}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-accent-coral-400 hover:bg-accent-coral-500/10 hover:text-accent-coral-300"
                      disabled={deleting === subject.id}
                      aria-label={tCommon("delete")}
                    >
                      {deleting === subject.id ? (
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
                        onClick={() => handleDelete(subject.id)}
                        className="bg-accent-coral-500 hover:bg-accent-coral-600"
                      >
                        {tCommon("delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Create dialog --------------------------------------------- */

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

/* -- Edit dialog ----------------------------------------------- */

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
