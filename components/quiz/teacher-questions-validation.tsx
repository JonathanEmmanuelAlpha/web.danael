"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Filter,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Check,
  X,
  Search as SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading";
import { QuestionCard } from "./question-card";
import { QuestionEditDialog } from "./question-edit-dialog";
import { AiGenerateDialog } from "./ai-generate-dialog";
import {
  listGeneratedQuestionsAction,
  listSubjectsForFilterAction,
  listSkillsForFilterAction,
  verifyQuestionAction,
  deleteQuestionAction,
  bulkVerifyQuestionsAction,
} from "@/server/actions/ai-questions";
import type { GeneratedQuestionListItem } from "@/server/services/ai-questions";

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface SkillOption {
  id: string;
  name: string;
  code: string;
  subjectId: string | null;
  type: string;
}

interface TeacherQuestionsValidationProps {
  /** Teacher's DB user id (for audit logs / ownership). */
  teacherId: string;
}

/**
 * §10.4 — Teacher validation page for AI-generated questions.
 *
 * Features:
 *  - Filter bar: subject, skill, "unverified only" switch, search input
 *  - Glass-card list of generated questions with source badge, type, difficulty
 *  - Per-question actions: Edit (dialog), Verify (green), Delete (red confirm)
 *  - Pagination
 *  - Bulk select + bulk verify
 *  - "Generate AI questions" trigger (opens the AiGenerateDialog)
 *  - Empty state when no questions exist
 */
export function TeacherQuestionsValidation({
  teacherId,
}: TeacherQuestionsValidationProps) {
  const t = useTranslations("AiQuestions");

  /* -- Filter state --------------------------------------- */
  const [subjectId, setSubjectId] = React.useState<string>("");
  const [skillId, setSkillId] = React.useState<string>("");
  const [unverifiedOnly, setUnverifiedOnly] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  /* -- Data state ---------------------------------------- */
  const [items, setItems] = React.useState<GeneratedQuestionListItem[] | null>(
    null,
  );
  const [total, setTotal] = React.useState(0);
  const [subjects, setSubjects] = React.useState<SubjectOption[]>([]);
  const [skills, setSkills] = React.useState<SkillOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  /* -- Selection / dialog state -------------------------- */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editQuestion, setEditQuestion] =
    React.useState<GeneratedQuestionListItem | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState(false);

  /* -- Initial load (subjects) --------------------------- */
  React.useEffect(() => {
    listSubjectsForFilterAction().then((res) => {
      if (res.success && res.data) setSubjects(res.data);
    });
  }, []);

  /* -- Reload skills when the subject filter changes ---- */
  React.useEffect(() => {
    listSkillsForFilterAction(subjectId ? { subjectId } : {}).then((res) => {
      if (res.success && res.data) setSkills(res.data);
      setSkillId("");
    });
  }, [subjectId]);

  /* -- Reload questions on filter change ---------------- */
  React.useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      listGeneratedQuestionsAction({
        subjectId: subjectId || undefined,
        skillId: skillId || undefined,
        unverifiedOnly,
        search: search || undefined,
        page,
        pageSize,
      })
        .then((res) => {
          if (res.success && res.data) {
            setItems(res.data.items);
            setTotal(res.data.total);
          } else {
            setItems([]);
            setTotal(0);
          }
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [subjectId, skillId, unverifiedOnly, search, page]);

  /* -- Handlers ----------------------------------------- */
  function reload() {
    setLoading(true);
    listGeneratedQuestionsAction({
      subjectId: subjectId || undefined,
      skillId: skillId || undefined,
      unverifiedOnly,
      search: search || undefined,
      page,
      pageSize,
    })
      .then((res) => {
        if (res.success && res.data) {
          setItems(res.data.items);
          setTotal(res.data.total);
        }
      })
      .finally(() => setLoading(false));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!items || items.length === 0) return;
    const allSelected = items.every((i) => selected.has(i.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        items.forEach((i) => next.delete(i.id));
      } else {
        items.forEach((i) => next.add(i.id));
      }
      return next;
    });
  }

  async function handleVerify(questionId: string) {
    setPendingAction(true);
    const res = await verifyQuestionAction({ questionId });
    setPendingAction(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("verify"));
      return;
    }
    toast.success(t("verifiedSuccess"));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    reload();
  }

  async function handleBulkVerify() {
    if (selected.size === 0) return;
    setPendingAction(true);
    const res = await bulkVerifyQuestionsAction({
      questionIds: Array.from(selected),
    });
    setPendingAction(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("bulkVerify"));
      return;
    }
    toast.success(t("bulkVerified", { count: res.data.verified }));
    setSelected(new Set());
    reload();
  }

  async function handleDelete() {
    if (!deleteId) return;
    setPendingAction(true);
    const res = await deleteQuestionAction({ questionId: deleteId });
    setPendingAction(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("delete"));
      return;
    }
    toast.success(t("deleteSuccess"));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(deleteId);
      return next;
    });
    setDeleteId(null);
    reload();
  }

  function openEdit(q: GeneratedQuestionListItem) {
    setEditQuestion(q);
    setEditOpen(true);
  }

  /* -- Derived -------------------------------------------- */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const allOnPageSelected =
    items !== null &&
    items.length > 0 &&
    items.every((i) => selected.has(i.id));

  /* -- Render -------------------------------------------- */
  return (
    <div className="space-y-5">
      {/* -- Filter bar --------------------------------------- */}
      <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="size-4" />
          {t("filters")}
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("subject")}</Label>
            <Select
              value={subjectId || "all"}
              onValueChange={(v) => {
                setSubjectId(v === "all" ? "" : v);
                setPage(1);
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

          {/* Skill */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("skill")}</Label>
            <Select
              value={skillId || "all"}
              onValueChange={(v) => {
                setSkillId(v === "all" ? "" : v);
                setPage(1);
              }}
              disabled={skills.length === 0}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={t("allSkills")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allSkills")}</SelectItem>
                {skills.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("search")}</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("searchPlaceholder")}
                className="h-9 pl-9"
              />
            </div>
          </div>

          {/* Unverified only */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-2.5">
            <Label
              htmlFor="unverified-only"
              className="cursor-pointer text-xs font-medium"
            >
              {t("unverifiedOnly")}
            </Label>
            <Switch
              id="unverified-only"
              checked={unverifiedOnly}
              onCheckedChange={(v) => {
                setUnverifiedOnly(Boolean(v));
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* -- Bulk actions bar -------------------------------- */}
      {selected.size > 0 ? (
        <div className="glass-strong flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 animate-slide-up">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="brand" size="sm">
              {t("selected", { count: selected.size })}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={pendingAction}
            >
              <X className="size-3.5" />
              {t("clearSelection")}
            </Button>
          </div>
          <Button
            variant="brand"
            size="sm"
            onClick={() => void handleBulkVerify()}
            disabled={pendingAction}
          >
            {pendingAction ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            {t("bulkVerify")}
          </Button>
        </div>
      ) : null}

      {/* -- List -------------------------------------------- */}
      {loading && items === null ? (
        <GridSkeleton count={4} columns={1} />
      ) : items === null ? null : items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={
            search || subjectId || skillId
              ? t("noMatchingQuestions")
              : t("noQuestions")
          }
          description={
            search || subjectId || skillId
              ? t("noMatchingQuestionsHint")
              : t("noQuestionsHint")
          }
        />
      ) : (
        <>
          {/* Select-all row */}
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              id="select-all"
              checked={allOnPageSelected}
              onCheckedChange={toggleSelectAll}
            />
            <Label
              htmlFor="select-all"
              className="cursor-pointer text-xs text-muted-foreground"
            >
              {t("selectPage")}
            </Label>
          </div>

          <ul className="space-y-4">
            {items.map((q, idx) => {
              const isSelected = selected.has(q.id);
              const isVerified = q.source === "verified";
              return (
                <li key={q.id} className="animate-fade-up">
                  <div className="relative">
                    {/* Selection checkbox */}
                    <div className="absolute left-3 top-3 z-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(q.id)}
                      />
                    </div>
                    <div className="pl-9">
                      <QuestionCard
                        question={{
                          id: q.id,
                          label: q.label,
                          type: q.type,
                          source: q.source,
                          difficulty: q.difficulty,
                          explanation: q.explanation,
                          options: q.options,
                        }}
                        index={(page - 1) * pageSize + idx + 1}
                        showExplanation
                        readOnly
                        header={
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {q.skill ? (
                              <Badge variant="outline" size="sm">
                                {q.skill.name}
                              </Badge>
                            ) : null}
                            {q.subjectName ? (
                              <Badge variant="secondary" size="sm">
                                {q.subjectName}
                              </Badge>
                            ) : null}
                            {q.generatedByModel ? (
                              <span className="text-muted-foreground">
                                {t("modelLabel")}:{" "}
                                <span className="font-mono">
                                  {q.generatedByModel}
                                </span>
                              </span>
                            ) : null}
                            <span className="text-muted-foreground">
                              {t("createdAtLabel")}:{" "}
                              {new Date(q.createdAt).toLocaleDateString()}
                            </span>
                            {q.verifiedAt ? (
                              <span className="text-green-400">
                                {t("verifiedAtLabel")}:{" "}
                                {new Date(q.verifiedAt).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        }
                        actions={
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(q)}
                              disabled={pendingAction}
                            >
                              <Pencil className="size-3.5" />
                              {t("edit")}
                            </Button>
                            {isVerified ? (
                              <Button variant="ghost" size="sm" disabled>
                                <CheckCircle2 className="size-3.5 text-green-400" />
                                {t("verified")}
                              </Button>
                            ) : (
                              <Button
                                variant="brand"
                                size="sm"
                                onClick={() => void handleVerify(q.id)}
                                disabled={pendingAction}
                              >
                                <Check className="size-3.5" />
                                {t("verify")}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("delete")}
                              onClick={() => setDeleteId(q.id)}
                              disabled={pendingAction}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        }
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* -- Pagination ---------------------------------- */}
          {totalPages > 1 ? (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-xs text-muted-foreground">
                {t("showingResults", { from, to, total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t("prev")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t("page", { page, total: totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* -- Edit dialog -------------------------------------- */}
      <QuestionEditDialog
        question={editQuestion}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={reload}
        onVerified={reload}
      />

      {/* -- Delete confirmation ---------------------------- */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction}>
              {t("clearSelection")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={pendingAction}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pendingAction ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden teacherId ref to avoid unused-prop lint */}
      <span className="sr-only" data-teacher-id={teacherId} />
    </div>
  );
}

/**
 * Header action button — opens the AI generate dialog.
 * Exported separately so the page can drop it into the PageHeader `actions` slot.
 */
export function GenerateQuestionsButton() {
  // Re-export the trigger for convenience.
  return <AiGenerateDialog />;
}

// Silence unused-import warnings for icons that may be tree-shaken in
// future refactors.
void cn;
