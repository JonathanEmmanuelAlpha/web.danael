"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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
import { CreditCard, Receipt } from "lucide-react";
import type { PaymentWithSubscription } from "@/server/services/payments";

interface PaymentHistoryProps {
  payments: PaymentWithSubscription[];
  loading?: boolean;
  /** Compact mode (fewer columns). */
  compact?: boolean;
}

const STATUS_VARIANT: Record<string, string> = {
  pending: "warning",
  succeeded: "success",
  failed: "destructive",
  refunded: "info",
  disputed: "destructive",
};

export function PaymentHistory({ payments, loading, compact }: PaymentHistoryProps) {
  const t = useTranslations("Payments");
  const tStatus = useTranslations("Payments.status");

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title={t("noPayments")}
        description={t("noPaymentsHint")}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("amount")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("provider")}</TableHead>
            {!compact && (
              <TableHead className="hidden md:table-cell">{t("transactionId")}</TableHead>
            )}
            <TableHead>{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {new Date(p.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="font-medium">
                {new Intl.NumberFormat("fr-FR").format(Number(p.amount))} {p.currency}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline" className="font-mono text-xs">
                  {t(`provider_${p.provider}` as never)}
                </Badge>
              </TableCell>
              {!compact && (
                <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                  {p.providerTransactionId ?? "—"}
                </TableCell>
              )}
              <TableCell>
                <Badge variant={(STATUS_VARIANT[p.status] ?? "default") as never}>
                  {tStatus(p.status as never)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

void Receipt;
