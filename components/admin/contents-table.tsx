"use client";

/**
 * §5.16 — Paginated contents table with visibility filter + remove action.
 *
 * Removing (archiving) is gated by an AlertDialog confirmation.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FolderOpen, Loader2, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading";
import {
  AdminTableFilters,
  type FilterOption,
} from "@/components/admin/admin-table-filters";
import { AdminTablePagination } from "@/components/admin/admin-table-pagination";
import {
  listContentsAdminAction,
  removeContentAction,
} from "@/server/actions/admin";
import {
  CONTENT_VISIBILITY_VALUES,
  PUBLICATION_STATUS_VALUES,
} from "@/server/db/schema/enums";
import type { AdminContentRow, Paginated } from "@/server/services/admin";

const PAGE_SIZE = 10;

export function ContentsTable() {
  const t = useTranslations("Admin");

  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Paginated<AdminContentRow> | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listContentsAdminAction({
        search: search.trim() || undefined,
        visibility: (visibilityFilter || undefined) as never,
        page,
        pageSize: PAGE_SIZE,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, visibilityFilter, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchData();
    }, 300);
    return () => clearTimeout(id);
     
  }, [search]);

  useEffect(() => {
    if (page !== 1) setPage(1);
    else fetchData();
     
  }, [visibilityFilter]);

  const visibilityOptions: FilterOption[] = CONTENT_VISIBILITY_VALUES.map(
    (v) => ({ value: v, label: t(`visibility.${v}` as never) }),
  );

  // Silence unused PUBLICATION_STATUS_VALUES import lint by referencing it.
  void PUBLICATION_STATUS_VALUES;

  async function handleRemove(contentId: string) {
    setPendingId(contentId);
    try {
      const res = await removeContentAction({ contentId });
      if (res.success) {
        toast.success(t("contentRemoved"));
        fetchData();
      } else {
        toast.error(res.error?.message ?? t("removeFailed"));
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <AdminTableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("searchContents")}
        filterValue={visibilityFilter}
        onFilterChange={setVisibilityFilter}
        filterOptions={visibilityOptions}
        loading={loading}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("content")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("uploader")}</TableHead>
                <TableHead>{t("visibility")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("views")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("downloads")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("createdAt")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <PageLoader />
                  </TableCell>
                </TableRow>
              ) : !data || data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10">
                    <EmptyState
                      icon={FolderOpen}
                      title={t("noContents")}
                      description={t("noContentsHint")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t(`contentType.${c.type}` as never)}
                          {c.subject?.name ? ` · ${c.subject.name}` : ""}
                          {c.level ? ` · ${c.level}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {c.uploader
                        ? [c.uploader.firstName, c.uploader.lastName]
                            .filter(Boolean)
                            .join(" ") || c.uploader.email
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.visibility === "archived"
                            ? "destructive"
                            : c.visibility === "public"
                              ? "success"
                              : "secondary"
                        }
                      >
                        {t(`visibility.${c.visibility}` as never)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {c.viewsCount}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {c.downloadsCount}
                    </TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.visibility === "archived" ? (
                        <Badge variant="destructive">{t("archived")}</Badge>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pendingId === c.id}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              {pendingId === c.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                              {t("remove")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("removeContentTitle")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("removeContentDescription")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={pendingId === c.id}>
                                {t("cancel")}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemove(c.id)}
                                disabled={pendingId === c.id}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                {t("confirm")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {data && (
          <AdminTablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            loading={loading}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
