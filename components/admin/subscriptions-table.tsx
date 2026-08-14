"use client";

/**
 * §5.16 — Subscriptions table with status filter + pagination.
 *
 * Uses the admin server action `listAdminSubscriptionsAction`.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

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
import { listAdminSubscriptionsAction } from "@/server/actions/admin";
import { SUBSCRIPTION_STATUS_VALUES } from "@/server/db/schema/enums";
import type { Subscription, Paginated } from "@/server/services/admin";

const PAGE_SIZE = 10;

export function SubscriptionsTable() {
  const t = useTranslations("Admin");

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Paginated<Subscription> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAdminSubscriptionsAction({
        status: (statusFilter || undefined) as never,
        page,
        pageSize: PAGE_SIZE,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (page !== 1) setPage(1);
    else fetchData();
     
  }, [statusFilter]);

  const statusOptions: FilterOption[] = SUBSCRIPTION_STATUS_VALUES.map((s) => ({
    value: s,
    label: t(`subscriptionStatus.${s}` as never),
  }));

  return (
    <div className="space-y-4">
      <AdminTableFilters
        search=""
        onSearchChange={() => undefined}
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={statusOptions}
        filterAllLabel={t("allStatuses")}
        loading={loading}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("plan")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("startedAt")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("endsAt")}</TableHead>
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
                      icon={CreditCard}
                      title={t("noSubscriptions")}
                      description={t("noSubscriptionsHint")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant="brand">
                        {t(`plans.${s.planType}` as never)}
                      </Badge>
                      {s.autoRenew && (
                        <Badge variant="info" size="sm" className="ml-2">
                          {t("autoRenew")}
                        </Badge>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {s.userId ? `User · ${s.userId.slice(0, 8)}` : ""}
                        {s.schoolId ? `School · ${s.schoolId.slice(0, 8)}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Intl.NumberFormat("fr-FR").format(Number(s.amount))}{" "}
                      {s.currency}
                    </TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(s.startedAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap text-sm text-muted-foreground">
                      {s.endsAt
                        ? new Date(s.endsAt).toLocaleDateString("fr-FR")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.status === "active"
                            ? "success"
                            : s.status === "cancelled" || s.status === "expired"
                              ? "destructive"
                              : s.status === "past_due"
                                ? "warning"
                                : "secondary"
                        }
                      >
                        {t(`subscriptionStatus.${s.status}` as never)}
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
