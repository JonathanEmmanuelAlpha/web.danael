"use client";

/**
 * §5.16 — Report detail dialog with resolve / dismiss actions.
 *
 * The initial `report` prop is loaded by the parent (ReportsList) but on
 * open we refresh from the server via `getReportAction` so the resolver
 * info is up-to-date.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Check, X, AlertTriangle, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  resolveReportAction,
  dismissReportAction,
  getReportAction,
} from "@/server/actions/moderation";
import type { ModerationReportWithRelations } from "@/server/services/moderation";

export interface ReportDetailProps {
  report: ModerationReportWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}

export function ReportDetail({
  report,
  open,
  onOpenChange,
  onResolved,
}: ReportDetailProps) {
  const t = useTranslations("Admin");
  const [detail, setDetail] = useState<ModerationReportWithRelations | null>(
    report,
  );
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setDetail(report);
    if (!report || !open) return;
    let cancelled = false;
    setLoading(true);
    getReportAction({ id: report.id })
      .then((res) => {
        if (cancelled) return;
        if (res.success) setDetail(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report, open]);

  if (!detail) return null;

  const isClosed = detail.status === "resolved" || detail.status === "dismissed";

  async function handleResolve(action: "approved" | "removed" | "warning") {
    if (!detail) return;
    setPending(action);
    try {
      const res = await resolveReportAction({ id: detail.id, action });
      if (res.success) {
        toast.success(t("reportResolved"));
        onResolved();
      } else {
        toast.error(res.error?.message ?? t("resolveFailed"));
      }
    } finally {
      setPending(null);
    }
  }

  async function handleDismiss() {
    if (!detail) return;
    setPending("dismiss");
    try {
      const res = await dismissReportAction({ id: detail.id });
      if (res.success) {
        toast.success(t("reportDismissed"));
        onResolved();
      } else {
        toast.error(res.error?.message ?? t("dismissFailed"));
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("reportDetail")}</DialogTitle>
          <DialogDescription>{t("reportDetailHint")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("target")}
                </p>
                <Badge variant="outline" size="sm" className="mt-1">
                  {t(`targetType.${detail.targetType}` as never)}
                </Badge>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {detail.targetId}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("status")}
                </p>
                <Badge
                  className="mt-1"
                  variant={
                    detail.status === "resolved"
                      ? "success"
                      : detail.status === "dismissed"
                        ? "secondary"
                        : "warning"
                  }
                >
                  {t(`reportStatus.${detail.status}` as never)}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("reporter")}
                </p>
                <p className="mt-1 text-sm">
                  {detail.reporter
                    ? [detail.reporter.firstName, detail.reporter.lastName]
                        .filter(Boolean)
                        .join(" ") || detail.reporter.email
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("createdAt")}
                </p>
                <p className="mt-1 text-sm">
                  {new Date(detail.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
              {detail.resolver && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("resolvedBy")}
                  </p>
                  <p className="mt-1 text-sm">
                    {[
                      detail.resolver.firstName,
                      detail.resolver.lastName,
                    ]
                      .filter(Boolean)
                      .join(" ") || detail.resolver.email}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("reason")}
              </p>
              <p className="mt-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
                {detail.reason}
              </p>
            </div>
          </div>
        )}

        {!isClosed && (
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              disabled={pending !== null}
              className="text-muted-foreground"
            >
              {pending === "dismiss" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              <X className="size-4" />
              {t("dismiss")}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResolve("approved")}
                disabled={pending !== null}
              >
                {pending === "approved" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                <Check className="size-4" />
                {t("approved")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResolve("warning")}
                disabled={pending !== null}
              >
                {pending === "warning" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                <AlertTriangle className="size-4" />
                {t("warning")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleResolve("removed")}
                disabled={pending !== null}
              >
                {pending === "removed" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                <Trash2 className="size-4" />
                {t("removed")}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
