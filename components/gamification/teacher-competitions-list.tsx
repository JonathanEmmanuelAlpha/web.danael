"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loader2, Plus, Trophy, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge as UIBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading";
import { CompetitionCard } from "@/components/gamification/competition-card";
import {
  deleteCompetitionAction,
  listCompetitionsAction,
  publishCompetitionAction,
} from "@/server/actions/competitions";
import type { CompetitionListItem } from "@/server/services/competitions";

export function TeacherCompetitionsList({
  teacherId,
}: {
  teacherId: string;
}) {
  const t = useTranslations("Competitions");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const [items, setItems] = useState<CompetitionListItem[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCompetitionsAction({ page: 1, pageSize: 100 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.success ? res.data.items : []);
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  async function handlePublish(id: string) {
    setPendingId(id);
    const res = await publishCompetitionAction(id);
    setPendingId(null);
    if (res.success) {
      toast.success(t("published"));
      router.refresh();
    } else {
      toast.error(res.error.message ?? t("publishFailed"));
    }
  }

  async function handleDelete(id: string) {
    setPendingId(id);
    const res = await deleteCompetitionAction(id);
    setPendingId(null);
    if (res.success) {
      toast.success(t("deleted"));
      setItems((prev) => (prev ?? []).filter((c) => c.id !== id));
      router.refresh();
    } else {
      toast.error(res.error.message ?? t("deleteFailed"));
    }
  }

  if (items === null) {
    return <GridSkeleton count={6} columns={3} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title={t("noCompetitions")}
        description={t("noCompetitionsHint")}
        action={{ label: t("create"), href: "/teacher-competitions/new" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button asChild variant="brand" size="sm">
          <Link href="/teacher-competitions/new">
            <Plus className="size-4" />
            {t("create")}
          </Link>
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <li key={c.id} className="flex flex-col gap-2">
            <CompetitionCard competition={c} variant="teacher" />
            <div className="flex items-center gap-1.5">
              {c.status === "draft" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={pendingId === c.id}
                  onClick={() => handlePublish(c.id)}
                >
                  {pendingId === c.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {t("publish")}
                </Button>
              ) : null}
              <Button asChild variant="ghost" size="sm">
                <Link href={`/teacher-competitions/${c.id}`}>
                  <PencilLine className="size-4" />
                  {tCommon("edit")}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={pendingId === c.id}
                onClick={() => handleDelete(c.id)}
                aria-label={tCommon("delete")}
              >
                {tCommon("delete")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-hidden>
        <UIBadge variant="secondary">{items.length}</UIBadge>
      </p>
    </div>
  );
}
