"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { toast } from "sonner";
import {
  Eye,
  Pencil,
  Trash2,
  Send,
  Loader2,
  Upload,
  BookOpen,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import { ContentTypeBadge } from "./content-type-badge";
import {
  deleteContentAction,
  listContentsAction,
  publishContentAction,
} from "@/server/actions/contents";
import type { ContentListItem } from "@/server/services/contents";

export interface TeacherContentsListProps {
  teacherId: string;
}

/**
 * Lists contents uploaded by the current teacher.
 *
 * Shows the publication status, views count, and quick actions:
 *  - view (link to /contents/[id])
 *  - edit (link to /contents/[id]/edit)
 *  - publish (publish a draft)
 *  - delete (archive)
 */
export function TeacherContentsList({ teacherId }: TeacherContentsListProps) {
  const t = useTranslations("Contents");
  const tCommon = useTranslations("Common");
  const [items, setItems] = useState<ContentListItem[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listContentsAction({
      uploadedBy: teacherId,
      publicationStatus: undefined, // Show all statuses.
      visibility: undefined,
      page: 1,
      pageSize: 100,
      sort: "recent",
    }).then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data.items : []);
      if (!res.success) {
        toast.error(res.error?.message ?? t("loadError"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [teacherId, t]);

  async function handlePublish(id: string) {
    setPendingId(id);
    const res = await publishContentAction(id);
    setPendingId(null);
    if (!res.success) {
      toast.error(res.error?.message ?? t("publishError"));
      return;
    }
    toast.success(t("published"));
    // Refresh local list (cheap — just bump state to re-render).
    setItems((prev) =>
      prev
        ? prev.map((c) =>
            c.id === id ? { ...c, publicationStatus: "published" as const } : c,
          )
        : prev,
    );
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    setPendingId(id);
    const res = await deleteContentAction(id);
    setPendingId(null);
    if (!res.success) {
      toast.error(res.error?.message ?? t("deleteError"));
      return;
    }
    toast.success(t("archived"));
    setItems((prev) =>
      prev
        ? prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  publicationStatus: "archived" as const,
                  visibility: "archived" as const,
                }
              : c,
          )
        : prev,
    );
  }

  if (items === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Upload}
        title={t("noContents")}
        description={t("noContentsHint")}
        action={{ label: t("upload"), href: "/teacher/contents/new" }}
      />
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y divide-border">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <ContentTypeBadge type={c.type} />
                <Badge variant="outline" size="sm">
                  {t(`status.${c.publicationStatus}` as const)}
                </Badge>
                {c.visibility !== "public" && (
                  <Badge variant="secondary" size="sm">
                    {t(`visibility.${c.visibility}` as const)}
                  </Badge>
                )}
              </div>
              <Link
                href={`/teacher/contents/${c.id}`}
                className="block truncate font-medium text-foreground hover:text-primary-700 dark:hover:text-primary-400"
              >
                {c.title}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {c.subject && (
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="size-3" />
                    {c.subject.name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3" />
                  {c.viewsCount} {t("views")}
                </span>
                {c.year && <span>{c.year}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/teacher/contents/${c.id}`}>
                  <Eye className="size-4" />
                  <span className="sr-only">{tCommon("view")}</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/teacher/contents/${c.id}/edit`}>
                  <Pencil className="size-4" />
                  <span className="sr-only">{tCommon("edit")}</span>
                </Link>
              </Button>
              {c.publicationStatus !== "published" &&
                c.publicationStatus !== "archived" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePublish(c.id)}
                    disabled={pendingId === c.id}
                  >
                    {pendingId === c.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    <span className="sr-only">{t("publish")}</span>
                  </Button>
                )}
              {c.publicationStatus !== "archived" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(c.id)}
                  disabled={pendingId === c.id}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">{tCommon("delete")}</span>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
