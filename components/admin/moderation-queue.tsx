"use client";

/**
 * §5.16 — Moderation queue: quick-glance of pending reports with quick
 * actions (resolve / dismiss inline).
 *
 * Renders the most recent 10 pending reports. Used on the admin dashboard
 * as a quick-action widget.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { ShieldAlert, Loader2, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading";
import {
  listReportsAction,
  resolveReportAction,
  dismissReportAction,
} from "@/server/actions/moderation";
import type { PaginatedReports } from "@/server/services/moderation";

export function ModerationQueue() {
  const t = useTranslations("Admin");

  const [data, setData] = useState<PaginatedReports | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await listReportsAction({
        status: "open",
        page: 1,
        pageSize: 5,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQueue();
     
  }, []);

  async function handleQuickAction(
    id: string,
    action: "dismiss" | "approved" | "removed",
  ) {
    setPendingId(id);
    try {
      const res =
        action === "dismiss"
          ? await dismissReportAction({ id })
          : await resolveReportAction({ id, action });
      if (res.success) {
        toast.success(
          action === "dismiss" ? t("reportDismissed") : t("reportResolved"),
        );
        fetchQueue();
      } else {
        toast.error(res.error?.message ?? t("actionFailed"));
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              {t("moderationQueue")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("moderationQueueHint")}
            </p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/moderation">
            {t("viewAll")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="p-4">
        {loading && !data ? (
          <PageLoader />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title={t("queueEmpty")}
            description={t("queueEmptyHint")}
          />
        ) : (
          <ul className="space-y-3">
            {data.items.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" size="sm">
                      {t(`targetType.${r.targetType}` as never)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{r.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.reporter
                      ? [r.reporter.firstName, r.reporter.lastName]
                          .filter(Boolean)
                          .join(" ") || r.reporter.email
                      : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendingId === r.id}
                    onClick={() => handleQuickAction(r.id, "dismiss")}
                  >
                    {pendingId === r.id && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {t("dismiss")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pendingId === r.id}
                    onClick={() => handleQuickAction(r.id, "removed")}
                  >
                    {t("removed")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
