"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Smartphone, CreditCard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { PaymentProviderValue } from "@/server/db/schema/enums";

interface PaymentMethodSelectorProps {
  value: PaymentProviderValue;
  onChange: (provider: PaymentProviderValue) => void;
  /** Show only Mobile Money providers (MTN + Orange). */
  mobileMoneyOnly?: boolean;
  className?: string;
}

const PROVIDERS: Array<{
  value: PaymentProviderValue;
  labelKey: string;
  icon: typeof Smartphone;
  accent: string;
}> = [
  { value: "mtn_money", labelKey: "mtnMomo", icon: Smartphone, accent: "text-amber-600" },
  { value: "orange_money", labelKey: "orangeMoney", icon: Wallet, accent: "text-orange-500" },
  { value: "stripe", labelKey: "card", icon: CreditCard, accent: "text-foreground" },
];

export function PaymentMethodSelector({
  value,
  onChange,
  mobileMoneyOnly,
  className,
}: PaymentMethodSelectorProps) {
  const t = useTranslations("Payments.provider");
  const providers = PROVIDERS.filter((p) =>
    mobileMoneyOnly ? p.value === "mtn_money" || p.value === "orange_money" : true,
  );

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{t("label")}</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {providers.map((p) => {
          const Icon = p.icon;
          const active = value === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-accent",
                active && "border-primary-500 bg-primary-500/5 ring-1 ring-primary-500/40",
              )}
              aria-pressed={active}
            >
              <Icon className={cn("size-5 shrink-0", active ? p.accent : "text-muted-foreground")} />
              <span className="text-sm font-medium">{t(p.labelKey as never)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PayerMsisdnInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PayerMsisdnInput({ value, onChange, className }: PayerMsisdnInputProps) {
  const t = useTranslations("Payments");
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="payer-msisdn">{t("payerMsisdn")}</Label>
      <Input
        id="payer-msisdn"
        type="tel"
        inputMode="tel"
        placeholder="2376XXXXXXXX"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="tel-national"
      />
      <p className="text-xs text-muted-foreground">{t("payerMsisdnHint")}</p>
    </div>
  );
}
