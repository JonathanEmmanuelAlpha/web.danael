"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Invoice } from "@/server/db/schema/payments";

interface InvoiceListProps {
  invoices: Invoice[];
  loading?: boolean;
}

const STATUS_VARIANT: Record<string, string> = {
  draft: "secondary",
  issued: "info",
  paid: "success",
  void: "destructive",
  overdue: "destructive",
};

export function InvoiceList({ invoices, loading }: InvoiceListProps) {
  const t = useTranslations("Payments");
  const tStatus = useTranslations("Payments.invoiceStatus");
  const [downloading, setDownloading] = React.useState<string | null>(null);

  const handleDownload = async (invoice: Invoice) => {
    setDownloading(invoice.id);
    try {
      // For now we generate a printable HTML receipt client-side. In
      // production we'd fetch a signed PDF URL from the server.
      const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${invoice.number} — Danaël</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 24px; color: #1f2937; }
    h1 { color: #79c007; margin-bottom: 0; }
    .muted { color: #6b7280; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 32px; }
    th, td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .total { font-weight: 700; font-size: 18px; }
  </style>
</head>
<body>
  <h1>Danaël</h1>
  <p class="muted">Reçu / Facture n° ${invoice.number}</p>
  <p class="muted">Émise le ${new Date(invoice.issuedAt).toLocaleDateString("fr-FR")}</p>
  <table>
    <thead>
      <tr><th>Description</th><th>Statut</th><th>Montant</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Abonnement Danaël</td>
        <td>${invoice.status}</td>
        <td>${new Intl.NumberFormat("fr-FR").format(Number(invoice.amount))} XOF</td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td colspan="2" style="text-align: right;" class="total">Total</td>
      <td class="total">${new Intl.NumberFormat("fr-FR").format(Number(invoice.amount))} XOF</td></tr>
    </tfoot>
  </table>
  <p class="muted" style="margin-top: 32px;">Merci pour votre confiance — Danaël Cameroun 🇨🇲</p>
</body>
</html>`;
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.number}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("downloaded"));
    } catch {
      toast.error(t("downloadFailed"));
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t("noInvoices")}
        description={t("noInvoicesHint")}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("invoiceNumber")}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("issuedAt")}
            </TableHead>
            <TableHead>{t("amount")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("download")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-mono text-xs font-medium">
                {inv.number}
              </TableCell>
              <TableCell className="hidden sm:table-cell whitespace-nowrap text-sm">
                {new Date(inv.issuedAt).toLocaleDateString("fr-FR")}
              </TableCell>
              <TableCell className="font-medium">
                {new Intl.NumberFormat("fr-FR").format(Number(inv.amount))}
              </TableCell>
              <TableCell>
                <Badge
                  variant={(STATUS_VARIANT[inv.status] ?? "default") as never}
                >
                  {tStatus(inv.status as never)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(inv)}
                  disabled={downloading === inv.id}
                  aria-label={t("download")}
                >
                  {downloading === inv.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
