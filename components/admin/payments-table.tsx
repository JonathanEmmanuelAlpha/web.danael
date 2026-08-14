"use client";

/**
 * §5.16 — Payments table with status + provider filter + pagination.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";

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
import { listAdminPaymentsAction } from "@/server/actions/admin";
import {
  PAYMENT_STATUS_VALUES,
  PAYMENT_PROVIDER_VALUES,
} from "@/server/db/schema/enums";
import type { Payment, Paginated } from "@/server/services/admin";

const PAGE_SIZE = 10;

export function PaymentsTable() {
  const t = useTranslations("Admin");

  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Paginated<Payment> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAdminPaymentsAction({
        status: (statusFilter || undefined) as never,
        provider: (providerFilter || undefined) as never,
        page,
        pageSize: PAGE_SIZE,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, providerFilter, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (page !== 1) setPage(1);
    else fetchData();
     
  }, [statusFilter, providerFilter]);

  const statusOptions: FilterOption[] = PAYMENT_STATUS_VALUES.map((s) => ({
    value: s,
    label: t(`paymentStatus.${s}` as never),
  }));

  const providerOptions: FilterOption[] = PAYMENT_PROVIDER_VALUES.map((p) => ({
    value: p,
    label: t(`provider.${p}` as never),
  }));

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
          filterValue={providerFilter}
          onFilterChange={setProviderFilter}
          filterOptions={providerOptions}
          filterAllLabel={t("allProviders")}
          loading={loading}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("provider")}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("transactionId")}
                </TableHead>
                <TableHead>{t("status")}</TableHead>
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
                      icon={DollarSign}
                      title={t("noPayments")}
                      description={t("noPaymentsHint")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Intl.NumberFormat("fr-FR").format(Number(p.amount))}{" "}
                      {p.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {t(`provider.${p.provider}` as never)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                      {p.providerTransactionId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "succeeded"
                            ? "success"
                            : p.status === "failed"
                              ? "destructive"
                              : p.status === "refunded"
                                ? "info"
                                : "warning"
                        }
                      >
                        {t(`paymentStatus.${p.status}` as never)}
                      </Badge>
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
