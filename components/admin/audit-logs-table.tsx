"use client";

/**
 * §5.16 — Audit logs table with filters (actor, action, entity type, date
 * range) + pagination.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading";
import { AdminTablePagination } from "@/components/admin/admin-table-pagination";
import { listAuditLogsAction } from "@/server/actions/audit";
import type { PaginatedAuditLogs } from "@/server/services/audit";

const PAGE_SIZE = 15;

export function AuditLogsTable() {
  const t = useTranslations("Admin");

  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PaginatedAuditLogs | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAuditLogsAction({
        actorId: actorId.trim() || undefined,
        action: action.trim() || undefined,
        entityType: entityType.trim() || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [actorId, action, entityType, from, to, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleApplyFilters() {
    if (page !== 1) setPage(1);
    else fetchData();
  }

  function handleReset() {
    setActorId("");
    setAction("");
    setEntityType("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          placeholder={t("actorPlaceholder")}
          aria-label={t("actor")}
        />
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={t("actionPlaceholder")}
          aria-label={t("action")}
        />
        <Input
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder={t("entityPlaceholder")}
          aria-label={t("entity")}
        />
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label={t("from")}
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label={t("to")}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleApplyFilters} disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {t("apply")}
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset} disabled={loading}>
          {t("reset")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("action")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("actor")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("entity")}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("entityId")}
                </TableHead>
                <TableHead>{t("date")}</TableHead>
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
                      icon={ClipboardList}
                      title={t("noAuditLogs")}
                      description={t("noAuditLogsHint")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {log.actor ? (
                        <span className="text-sm">
                          {[log.actor.firstName, log.actor.lastName]
                            .filter(Boolean)
                            .join(" ") || log.actor.email}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("system")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      <span className="font-mono text-xs">{log.entityType}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                      {log.entityId}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("fr-FR")}
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
