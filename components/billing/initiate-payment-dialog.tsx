"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SelectField,
  TextField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { initiatePaymentAction } from "@/server/actions/payments";
import type { PlanType } from "@/server/providers/payments/types";

interface InitiatePaymentDialogProps {
  subscriptionId: string;
  amount: number;
  currency?: string;
  planType: PlanType;
  trigger?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

const initiatePaymentSchema = z
  .object({
    provider: z.enum(["mtn_money", "orange_money", "stripe"]),
    payerMsisdn: z.string(),
  })
  .superRefine((val, ctx) => {
    const isMobileMoney =
      val.provider === "mtn_money" || val.provider === "orange_money";
    if (isMobileMoney && val.payerMsisdn.length < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["payerMsisdn"],
        message: "Numéro de téléphone invalide (min. 8 chiffres)",
      });
    }
  });

type InitiatePaymentValues = z.infer<typeof initiatePaymentSchema>;

/**
 * §5.5 — Dialog to initiate a payment for a subscription.
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn wrappers (SelectField for the
 * provider, TextField for the payer MSISDN). The payer MSISDN is only
 * required for mobile-money providers — the Zod schema enforces this
 * conditionally via `superRefine`.
 */
export function InitiatePaymentDialog({
  subscriptionId,
  amount,
  currency = "XOF",
  planType,
  trigger,
  onOpenChange,
}: InitiatePaymentDialogProps) {
  const t = useTranslations("Payments");
  const tProvider = useTranslations("Payments.provider");
  const tBilling = useTranslations("Billing");

  const [open, setOpen] = React.useState(false);

  const form = useForm({
    defaultValues: {
      provider: "mtn_money",
      payerMsisdn: "",
    } as InitiatePaymentValues,
    validators: {
      onChange: initiatePaymentSchema,
    },
    onSubmit: async ({ value }) => {
      const isMobileMoney =
        value.provider === "mtn_money" || value.provider === "orange_money";
      const res = await initiatePaymentAction({
        subscriptionId,
        provider: value.provider,
        amount,
        currency,
        payerMsisdn: isMobileMoney ? value.payerMsisdn : undefined,
        description: `Abonnement Danaël — ${tBilling(`plans.${planType}.name` as const)}`,
      });

      if (!res.success) {
        toast.error(res.error.message);
        return;
      }

      toast.success(t("paymentInitiated"));
      if (res.data.redirectUrl) {
        // For card / Orange Money webpay, redirect the browser.
        window.location.href = res.data.redirectUrl;
      } else {
        // For MTN MoMo, prompt the user to validate on their phone.
        toast.info(t("momoPendingApproval"));
      }
      setOpen(false);
      onOpenChange?.(false);
    },
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand">
            <Zap className="size-4" />
            {t("initiate")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>{t("amount")}</Label>
            <Input
              value={`${new Intl.NumberFormat("fr-FR").format(amount)} ${currency}`}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>

          <form.Field name="provider">
            {(field) => (
              <SelectField
                field={field}
                label={tProvider("label")}
                options={[
                  { value: "mtn_money", label: tProvider("mtnMomo") },
                  { value: "orange_money", label: tProvider("orangeMoney") },
                  { value: "stripe", label: tProvider("card") },
                ]}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => state.values.provider as InitiatePaymentValues["provider"]}
          >
            {(provider) => {
              const isMobileMoney =
                provider === "mtn_money" || provider === "orange_money";
              return (
                <>
                  {isMobileMoney && (
                    <form.Field name="payerMsisdn">
                      {(field) => (
                        <TextField
                          field={field}
                          label={t("payerMsisdn")}
                          description={t("payerMsisdnHint")}
                          placeholder="2376XXXXXXXX"
                          type="tel"
                          inputClassName="h-11"
                        />
                      )}
                    </form.Field>
                  )}

                  {provider === "stripe" && (
                    <p className="text-xs text-muted-foreground">
                      {t("cardRedirectHint")}
                    </p>
                  )}
                </>
              );
            }}
          </form.Subscribe>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <DialogFooter>
                <SubmitButton
                  pending={isSubmitting}
                  disabled={!canSubmit}
                  className="w-full"
                >
                  <Zap className="size-4" />
                  {t("payNow")}
                </SubmitButton>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
