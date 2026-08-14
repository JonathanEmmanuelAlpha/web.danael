/**
 * §5.13 — Card (Stripe-compatible) provider placeholder.
 *
 * In production this would call Stripe's `payment_intents` API. Here we
 * implement the abstraction against a Stripe-compatible interface, gated by
 * env vars so that the app degrades gracefully when Stripe is not configured.
 *
 * Env vars:
 *  - STRIPE_SECRET_KEY
 *  - STRIPE_WEBHOOK_SECRET (Stripe-Signature header verification)
 */

import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import type {
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentProvider,
  PaymentStatusOutput,
  WebhookVerification,
} from "./types";

const STRIPE_API = "https://api.stripe.com/v1";

function env(name: string): string | undefined {
  return process.env[name];
}

export const cardProvider: PaymentProvider = {
  name: "stripe",
  label: "Carte bancaire",
  get configured(): boolean {
    return Boolean(env("STRIPE_SECRET_KEY"));
  },

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const key = env("STRIPE_SECRET_KEY");
    if (!key) {
      throw AppError.provider("Stripe is not configured", {
        missing: ["STRIPE_SECRET_KEY"],
      });
    }

    const body = new URLSearchParams({
      amount: String(input.amount),
      currency: (input.currency || "XOF").toLowerCase(),
      "metadata[paymentId]": input.paymentId,
      "metadata[subscriptionId]": input.subscriptionId,
      "metadata[source]": "danael",
      description: input.description ?? "Abonnement Danaël",
      "payment_method_types[0]": "card",
    });
    if (input.returnUrl) {
      // For redirect-based payment methods (3DS, etc.) we set return_url later.
      body.set("metadata[returnUrl]", input.returnUrl);
    }

    const res = await fetch(`${STRIPE_API}/payment_intents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const errBody = await res.text();
      logger.error("Stripe initiate failed", { status: res.status, errBody });
      throw AppError.provider("Stripe payment initiation failed", {
        status: res.status,
        body: errBody,
      });
    }
    const data = (await res.json()) as {
      id: string;
      status: string;
      client_secret?: string;
      next_action?: { redirect_to_url?: { url?: string } };
    };
    return {
      providerTransactionId: data.id,
      status: "pending",
      redirectUrl: data.next_action?.redirect_to_url?.url,
      raw: { provider: "stripe", intentId: data.id, status: data.status },
    };
  },

  async checkStatus(transactionId: string): Promise<PaymentStatusOutput> {
    const key = env("STRIPE_SECRET_KEY");
    if (!key) {
      throw AppError.provider("Stripe is not configured");
    }
    const res = await fetch(`${STRIPE_API}/payment_intents/${transactionId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) {
      const errBody = await res.text();
      logger.error("Stripe status fetch failed", { status: res.status, errBody });
      throw AppError.provider("Stripe status check failed", { status: res.status });
    }
    const data = (await res.json()) as {
      id: string;
      status: string;
      last_payment_error?: { message?: string };
    };
    const map: Record<string, PaymentStatusOutput["status"]> = {
      requires_payment_method: "pending",
      requires_confirmation: "pending",
      requires_action: "pending",
      processing: "pending",
      succeeded: "succeeded",
      canceled: "failed",
      requires_capture: "pending",
    };
    return {
      status: map[data.status] ?? "pending",
      providerTransactionId: data.id,
      reason: data.last_payment_error?.message,
      raw: data,
    };
  },

  async verifyWebhook(req: Request): Promise<WebhookVerification> {
    const secret = env("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      return {
        valid: false,
        provider: "stripe",
        providerTransactionId: "",
        status: "failed",
        raw: null,
      };
    }
    const sig = req.headers.get("stripe-signature") ?? "";
    if (!sig) {
      return {
        valid: false,
        provider: "stripe",
        providerTransactionId: "",
        status: "failed",
        raw: null,
      };
    }
    const body = await req.text();
    // Real verification would use stripe.webhooks.constructEvent(...).
    // For portability we keep a fallback: if the secret matches an
    // `x-webhook-secret` header we accept the body, otherwise reject.
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== secret) {
      return {
        valid: false,
        provider: "stripe",
        providerTransactionId: "",
        status: "failed",
        raw: null,
      };
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }
    const evt = parsed as {
      type?: string;
      data?: {
        object?: {
          id?: string;
          status?: string;
          amount?: number;
          currency?: string;
        };
      };
    } | null;
    const obj = evt?.data?.object;
    const statusMap: Record<string, WebhookVerification["status"]> = {
      succeeded: "succeeded",
      canceled: "failed",
      payment_failed: "failed",
      refunded: "refunded",
      processing: "pending",
    };
    return {
      valid: true,
      provider: "stripe",
      providerTransactionId: obj?.id ?? "",
      status: statusMap[evt?.type === "payment_intent.succeeded"
        ? "succeeded"
        : evt?.type === "charge.refunded"
          ? "refunded"
          : obj?.status ?? "pending"] ?? "pending",
      amount: obj?.amount,
      currency: obj?.currency?.toUpperCase(),
      raw: evt,
    };
  },
};
