"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookMarked, Plus } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  NumberField,
  SelectField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { listClassSubjectsAction } from "@/server/actions/classes";
import {
  assignSubjectAction,
  listSubjectsAction,
} from "@/server/actions/subjects";
import type { ClassSubjectWithRelations } from "@/server/services/classes";
import type { Subject } from "@/server/db/schema/schools";

interface ClassSubjectsListProps {
  classId: string;
  canManage: boolean;
}

const assignSubjectSchema = z.object({
  subjectId: z.string().min(1, "Veuillez choisir une matière"),
  coefficient: z.number().int().min(1, "Min 1").max(20, "Max 20"),
});

type AssignSubjectFormValues = z.infer<typeof assignSubjectSchema>;

/**
 * §5.3 — Lists subjects assigned to a class (with coefficient + teacher),
 * and lets a teacher/admin assign a new subject.
 *
 * IMPROVED: The assign-subject subform now uses TanStack Form + Zod + shadcn
 * NumberField/SelectField (not native HTML inputs or useState).
 */
export function ClassSubjectsList({
  classId,
  canManage,
}: ClassSubjectsListProps) {
  const t = useTranslations("Classes");
  const tCommon = useTranslations("Common");
  const [subjects, setSubjects] = useState<ClassSubjectWithRelations[] | null>(
    null,
  );
  const [catalog, setCatalog] = useState<Subject[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listClassSubjectsAction(classId).then((res) => {
      if (cancelled) return;
      setSubjects(res.success ? res.data : []);
    });
    if (canManage) {
      listSubjectsAction().then((res) => {
        if (cancelled) return;
        if (res.success) setCatalog(res.data);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [classId, canManage]);

  const form = useForm({
    defaultValues: {
      subjectId: "",
      coefficient: 1,
    } as AssignSubjectFormValues,
    validators: {
      onChange: assignSubjectSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await assignSubjectAction({
        classId,
        subjectId: value.subjectId,
        coefficient: value.coefficient,
      });
      if (!res.success) {
        toast.error(res.error?.message ?? t("assignSubject"));
        return;
      }
      toast.success(t("assignSubject"));
      setAssignOpen(false);
      form.reset();
      // Refresh list.
      const list = await listClassSubjectsAction(classId);
      if (list.success) setSubjects(list.data);
    },
  });

  if (subjects === null) {
    return (
      <Card className="p-5">
        <Skeleton className="h-6 w-1/3" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    );
  }

  if (subjects.length === 0 && !canManage) {
    return (
      <EmptyState
        icon={BookMarked}
        title={t("noSubjects")}
        description={t("noSubjectsHint")}
      />
    );
  }

  const availableCatalog = catalog.filter(
    (s) => !subjects.some((cs) => cs.subject.id === s.id),
  );

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="brand-outline" size="sm">
                <Plus className="size-4" />
                {t("assignSubject")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("assignSubject")}</DialogTitle>
                <DialogDescription>{t("chooseSubject")}</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void form.handleSubmit();
                }}
                className="space-y-4"
              >
                <form.Field name="subjectId">
                  {(field) => (
                    <SelectField
                      field={field}
                      label={t("chooseSubject")}
                      placeholder={t("chooseSubject")}
                      options={availableCatalog.map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.code})`,
                      }))}
                      required
                    />
                  )}
                </form.Field>
                <form.Field name="coefficient">
                  {(field) => (
                    <NumberField
                      field={field}
                      label={t("coefficient")}
                      min={1}
                      max={20}
                      step={1}
                    />
                  )}
                </form.Field>
                <form.Subscribe
                  selector={(state) =>
                    [state.canSubmit, state.isSubmitting] as const
                  }
                >
                  {([canSubmit, isSubmitting]) => (
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setAssignOpen(false)}
                        disabled={isSubmitting}
                      >
                        {tCommon("cancel")}
                      </Button>
                      <SubmitButton
                        pending={isSubmitting}
                        disabled={!canSubmit}
                      >
                        {tCommon("create")}
                      </SubmitButton>
                    </DialogFooter>
                  )}
                </form.Subscribe>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title={t("noSubjects")}
          description={t("noSubjectsHint")}
        />
      ) : (
        <ul className="space-y-2">
          {subjects.map((cs) => {
            const teacherName =
              cs.teacher && (cs.teacher.firstName || cs.teacher.lastName)
                ? `${cs.teacher.firstName ?? ""} ${cs.teacher.lastName ?? ""}`.trim()
                : null;
            return (
              <li key={cs.id}>
                <Card className="flex items-center gap-4 p-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-400">
                    <BookMarked className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {cs.subject.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {cs.subject.code}
                      {teacherName ? ` · ${teacherName}` : ""}
                    </p>
                  </div>
                  <Badge variant="brand" size="sm">
                    ×{cs.coefficient}
                  </Badge>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
