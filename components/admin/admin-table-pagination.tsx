"use client";

/**
 * §5.16 — Generic admin table pagination (prev / next + page indicator).
 *
 * Used by every admin table component. Calls `onPageChange` with the new
 * page number when the user clicks prev/next.
 */

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AdminTablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

export function AdminTablePagination({
  page,
  pageSize,
  total,
  loading,
  onPageChange,
}: AdminTablePaginationProps) {
  const t = useTranslations("Admin");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t("paginationRange", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("prev")}
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">{t("prev")}</span>
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("pageOf", { page, total: totalPages })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("next")}
        >
          <span className="hidden sm:inline">{t("next")}</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
