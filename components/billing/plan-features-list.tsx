import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanFeature } from "@/server/providers/payments/types";

interface PlanFeaturesListProps {
  features: PlanFeature[];
  className?: string;
  /** When true, render as compact (smaller text, denser spacing). */
  compact?: boolean;
}

/**
 * §5.13 — List of features for a plan, each with a check / cross icon.
 * Features with a `limit` show the limit value (or "unlimited").
 */
export function PlanFeaturesList({
  features,
  className,
  compact = false,
}: PlanFeaturesListProps) {
  const t = useTranslations("Billing.features");
  return (
    <ul className={cn("space-y-2.5", compact ? "text-xs" : "text-sm", className)}>
      {features.map((f) => {
        const label = t(f.key as never);
        const limitLabel =
          f.limit === null
            ? t("unlimited")
            : f.limit !== undefined
              ? t("limit", { count: f.limit })
              : null;
        return (
          <li key={f.key} className="flex items-start gap-2">
            {f.included ? (
              <Check className={cn("mt-0.5 size-4 shrink-0 text-success", compact && "size-3.5")} />
            ) : (
              <Minus className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground", compact && "size-3.5")} />
            )}
            <span
              className={cn(
                f.included ? "text-foreground" : "text-muted-foreground line-through",
                "leading-snug",
              )}
            >
              {label}
              {limitLabel && (
                <span className="ml-1 text-xs text-muted-foreground">· {limitLabel}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

void X;
