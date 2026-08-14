"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Calendar, CreditCard, Loader2, Ban, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cancelSubscriptionAction } from "@/server/actions/payments";
import type { Subscription } from "@/server/db/schema/payments";
import type { PlanType } from "@/server/providers/payments/types";

interface SubscriptionCardProps {
  subscription: Subscription | null;
  /** Optional: a free-plan "virtual" subscription (no row in DB yet). */
  freePlan?: boolean;
  className?: string;
}

const STATUS_VARIANT: Record<
  Subscription["status"],
  "default" | "success" | "warning" | "destructive" | "info"
> = {
  free: "secondary",
  active: "success",
  past_due: "warning",
  expired: "destructive",
  cancelled: "warning",
} as never;

export function SubscriptionCard({
  subscription,
  freePlan,
  className,
}: SubscriptionCardProps) {
  const t = useTranslations("Billing");
  const tStatus = useTranslations("Payments.status");
  const [cancelling, setCancelling] = React.useState(false);

  const planType = (subscription?.planType ?? "free") as PlanType;
  const planName = t(`plans.${planType}.name` as const);

  const amount = Number(subscription?.amount ?? 0);
  const currency = subscription?.currency ?? "XOF";
  const endsAt = subscription?.endsAt;
  const autoRenew = subscription?.autoRenew ?? false;
  const status = subscription?.status ?? "free";

  const handleCancel = async () => {
    if (!subscription) return;
    setCancelling(true);
    const res = await cancelSubscriptionAction({ id: subscription.id });
    setCancelling(false);
    if (res.success) {
      toast.success(t("cancelSuccess"));
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <Card className={cn("gap-0 overflow-hidden p-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
            <CreditCard className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold text-foreground">{planName}</h3>
              <Badge variant={(STATUS_VARIANT[status] ?? "default") as never}>
                {tStatus(status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {freePlan || !subscription ? (
                t("freeHint")
              ) : (
                <>
                  {new Intl.NumberFormat("fr-FR").format(amount)} {currency}
                  {autoRenew ? ` · ${t("autoRenew")}` : ""}
                </>
              )}
            </p>
          </div>
        </div>

        {subscription && subscription.status !== "cancelled" && subscription.status !== "expired" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="text-destructive hover:bg-destructive/5"
          >
            {cancelling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
            {t("cancel")}
          </Button>
        )}
      </div>

      {endsAt && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("renewalDate")}:</span>
            <span className="font-medium text-foreground">
              {new Date(endsAt).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {autoRenew ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <Ban className="size-4 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">{t("autoRenewLabel")}:</span>
            <span className="font-medium text-foreground">
              {autoRenew ? t("enabled") : t("disabled")}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
