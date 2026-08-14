"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanFeaturesList } from "./plan-features-list";
import type { PlanDefinition, PlanType } from "@/server/providers/payments/types";

interface PricingCardsProps {
  plans: PlanDefinition[];
  currentPlan?: PlanType;
  onSelectPlan?: (planType: PlanType) => void;
  /** When true, the CTA button reads "Contact us" instead of "Subscribe". */
  contactMode?: boolean;
  className?: string;
}

/**
 * §5.13 — Pricing cards shown on the public pricing page and on /billing.
 *
 * Each card shows: plan name, monthly price (XOF), tagline, and the full
 * feature list with check / cross marks. The "best value" plan (premium) is
 * highlighted with a brand border + badge.
 */
export function PricingCards({
  plans,
  currentPlan,
  onSelectPlan,
  contactMode = false,
  className,
}: PricingCardsProps) {
  const t = useTranslations("Billing");

  return (
    <div
      className={cn(
        "grid gap-6 md:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {plans.map((plan) => {
        const isCurrent = currentPlan === plan.type;
        const isBest = plan.type === "premium";
        return (
          <div
            key={plan.type}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md",
              isBest && "border-primary-500/60 ring-1 ring-primary-500/40",
              isCurrent && "border-primary-500",
            )}
          >
            {isBest && (
              <Badge
                variant="brand"
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
              >
                {t("bestValue")}
              </Badge>
            )}

            <div className="mb-4">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {t(`plans.${plan.type}.name` as const)}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`plans.${plan.type}.tagline` as const)}
              </p>
            </div>

            <div className="mb-5 flex items-baseline gap-1">
              <span className="font-display text-3xl font-bold text-foreground">
                {plan.price === 0
                  ? t("free")
                  : new Intl.NumberFormat("fr-FR").format(plan.price)}
              </span>
              {plan.price > 0 && (
                <span className="text-sm text-muted-foreground">
                  {plan.currency} / {t("month")}
                </span>
              )}
            </div>

            <PlanFeaturesList features={plan.features} className="mb-6 flex-1" />

            {isCurrent ? (
              <Button variant="outline" disabled className="w-full">
                {t("currentPlan")}
              </Button>
            ) : contactMode && plan.institutional ? (
              <Button variant="brand-outline" className="w-full" onClick={() => onSelectPlan?.(plan.type)}>
                {t("contactUs")}
              </Button>
            ) : (
              <Button
                variant={isBest ? "brand" : "outline"}
                className="w-full"
                onClick={() => onSelectPlan?.(plan.type)}
              >
                {plan.price === 0 ? t("startFree") : t("subscribe")}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Small badge shown beside the CTA when the plan includes a free trial. */
export function TrialBadge() {
  const t = useTranslations("Billing");
  return (
    <Badge variant="success" className="ml-2">
      {t("trialIncluded")}
    </Badge>
  );
}

void Check;
void X;
