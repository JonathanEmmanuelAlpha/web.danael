"use client";

/**
 * §5.16 — Paginated schools table with verify / unverify action.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { School as SchoolIcon, Loader2, CheckCircle2, Circle } from "lucide-react";

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
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading";
import {
  AdminTableFilters,
  type FilterOption,
} from "@/components/admin/admin-table-filters";
import { AdminTablePagination } from "@/components/admin/admin-table-pagination";
import { listAdminSchoolsAction, verifySchoolAction } from "@/server/actions/admin";
import type { AdminSchoolRow, Paginated } from "@/server/services/admin";

const PAGE_SIZE = 10;

export function SchoolsTable() {
  const t = useTranslations("Admin");

  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Paginated<AdminSchoolRow> | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAdminSchoolsAction({
        search: search.trim() || undefined,
        isVerified:
          verifiedFilter === "verified"
            ? true
            : verifiedFilter === "unverified"
              ? false
              : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, verifiedFilter, page, t]);

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
     
  }, [verifiedFilter]);

  const filterOptions: FilterOption[] = [
    { value: "verified", label: t("verified") },
    { value: "unverified", label: t("unverified") },
  ];

  async function handleVerify(schoolId: string, verified: boolean) {
    setPendingId(schoolId);
    try {
      const res = await verifySchoolAction({ schoolId, verified });
      if (res.success) {
        toast.success(verified ? t("schoolVerified") : t("schoolUnverified"));
        fetchData();
      } else {
        toast.error(res.error?.message ?? t("verifyFailed"));
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
        filterValue={verifiedFilter}
        onFilterChange={setVerifiedFilter}
        filterOptions={filterOptions}
        loading={loading}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("school")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("type")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("city")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("members")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <PageLoader />
                  </TableCell>
                </TableRow>
              ) : !data || data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10">
                    <EmptyState
                      icon={SchoolIcon}
                      title={t("noSchools")}
                      description={t("noSchoolsHint")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {s.logoUrl ? (
                           
                          <img
                            src={s.logoUrl}
                            alt=""
                            className="size-9 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                            <SchoolIcon className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {s.type ? (
                        <Badge variant="outline">
                          {t(`schoolType.${s.type}` as never)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {s.city ?? "—"}
                    </TableCell>
                    <TableCell>
                      {s.isVerified ? (
                        <Badge variant="success">
                          <CheckCircle2 className="size-3" />
                          {t("verified")}
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <Circle className="size-3" />
                          {t("unverified")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {s.membersCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.isVerified ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === s.id}
                          onClick={() => handleVerify(s.id, false)}
                        >
                          {pendingId === s.id && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          {t("unverify")}
                        </Button>
                      ) : (
                        <Button
                          variant="brand"
                          size="sm"
                          disabled={pendingId === s.id}
                          onClick={() => handleVerify(s.id, true)}
                        >
                          {pendingId === s.id && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          {t("verify")}
                        </Button>
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
