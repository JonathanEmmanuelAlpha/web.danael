"use client";

/**
 * §5.16 — Reports list with status filter + pagination.
 *
 * Clicking a row opens the ReportDetail dialog.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading";
import {
  AdminTableFilters,
  type FilterOption,
} from "@/components/admin/admin-table-filters";
import { AdminTablePagination } from "@/components/admin/admin-table-pagination";
import { ReportDetail } from "@/components/admin/report-detail";
import { listReportsAction } from "@/server/actions/moderation";
import {
  REPORT_STATUS_VALUES,
} from "@/server/db/schema/enums";
import {
  moderationTargetTypes,
  type ModerationTargetType,
} from "@/server/validators/admin";
import type {
  PaginatedReports,
  ModerationReportWithRelations,
} from "@/server/services/moderation";

const PAGE_SIZE = 10;

export function ReportsList() {
  const t = useTranslations("Admin");

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PaginatedReports | null>(null);
  const [selectedReport, setSelectedReport] =
    useState<ModerationReportWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReportsAction({
        status: (statusFilter || undefined) as never,
        targetType: (typeFilter || undefined) as ModerationTargetType | undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (page !== 1) setPage(1);
    else fetchData();
     
  }, [statusFilter, typeFilter]);

  const statusOptions: FilterOption[] = REPORT_STATUS_VALUES.map((s) => ({
    value: s,
    label: t(`reportStatus.${s}` as never),
  }));

  const typeOptions: FilterOption[] = moderationTargetTypes.map((tg) => ({
    value: tg,
    label: t(`targetType.${tg}` as never),
  }));

  function openReport(report: ModerationReportWithRelations) {
    setSelectedReport(report);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <AdminTableFilters
          search=""
          onSearchChange={() => undefined}
          filterValue={statusFilter}
          onFilterChange={setStatusFilter}
          filterOptions={statusOptions}
          filterAllLabel={t("allStatuses")}
          loading={loading}
        />
        <AdminTableFilters
          search=""
          onSearchChange={() => undefined}
          filterValue={typeFilter}
          onFilterChange={setTypeFilter}
          filterOptions={typeOptions}
          filterAllLabel={t("allTypes")}
          loading={loading}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("target")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("reporter")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("reason")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("createdAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <PageLoader />
                  </TableCell>
                </TableRow>
              ) : !data || data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10">
                    <EmptyState
                      icon={ShieldAlert}
                      title={t("noReports")}
                      description={t("noReportsHint")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openReport(r)}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <Badge variant="outline" size="sm">
                          {t(`targetType.${r.targetType}` as never)}
                        </Badge>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {r.targetId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {r.reporter
                            ? [r.reporter.firstName, r.reporter.lastName]
                                .filter(Boolean)
                                .join(" ") || r.reporter.email
                            : "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-xs">
                      <p className="truncate text-sm text-muted-foreground">
                        {r.reason}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "resolved"
                            ? "success"
                            : r.status === "dismissed"
                              ? "secondary"
                              : r.status === "in_review"
                                ? "info"
                                : "warning"
                        }
                      >
                        {t(`reportStatus.${r.status}` as never)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("fr-FR")}
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

      <ReportDetail
        report={selectedReport}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onResolved={() => {
          setDetailOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
