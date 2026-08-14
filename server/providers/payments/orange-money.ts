/**
 * §5.13 — Orange Money (Cameroun) provider.
 *
 * Implements the PaymentProvider interface against the Orange Money WebPayment API.
 *
 * Env vars:
 *  - ORANGE_MONEY_CLIENT_ID
 *  - ORANGE_MONEY_CLIENT_SECRET
 *  - ORANGE_MONEY_MERCHANT_KEY
 *  - ORANGE_MONEY_ENV ("sandbox" | "production"; default sandbox)
 *
 * Reference: https://developer.orange.com
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

const BASE_URLS = {
  sandbox: "https://sandbox.orange-sonatel.com",
  production: "https://api.orange.com",
} as const;

interface OmToken {
  access_token: string;
  expires_in: number;
  fetchedAt: number;
}

let cachedToken: OmToken | null = null;

function env(name: string): string | undefined {
  return process.env[name];
}

function getBaseUrl(): string {
  const e = env("ORANGE_MONEY_ENV") ?? "sandbox";
  return e === "production" ? BASE_URLS.production : BASE_URLS.sandbox;
}

async function fetchAccessToken(): Promise<string> {
  const clientId = env("ORANGE_MONEY_CLIENT_ID");
  const clientSecret = env("ORANGE_MONEY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw AppError.provider("Orange Money credentials are not configured", {
      missing: ["ORANGE_MONEY_CLIENT_ID", "ORANGE_MONEY_CLIENT_SECRET"],
    });
  }
  if (cachedToken && Date.now() - cachedToken.fetchedAt < (cachedToken.expires_in - 60) * 1000) {
    return cachedToken.access_token;
  }

  const url = `${getBaseUrl()}/oauth/v3/token`;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text();
    logger.error("Orange Money token fetch failed", { status: res.status, errBody });
    throw AppError.provider("Orange Money authentication failed", { status: res.status });
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 3600,
    fetchedAt: Date.now(),
  };
  return cachedToken.access_token;
}

export const orangeMoneyProvider: PaymentProvider = {
  name: "orange_money",
  label: "Orange Money",
  get configured(): boolean {
    return Boolean(
      env("ORANGE_MONEY_CLIENT_ID") &&
        env("ORANGE_MONEY_CLIENT_SECRET") &&
        env("ORANGE_MONEY_MERCHANT_KEY"),
    );
  },

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    if (!orangeMoneyProvider.configured) {
      throw AppError.provider("Orange Money is not configured");
    }
    const token = await fetchAccessToken();
    const merchantKey = env("ORANGE_MONEY_MERCHANT_KEY")!;
    const ref = input.paymentId;
    const url = `${getBaseUrl()}/orange-money-webpay/dev/v1/webpay`;

    const body = {
      merchant_key: merchantKey,
      currency: input.currency,
      order_id: ref,
      amount: Number(input.amount),
      ref: input.subscriptionId,
      customer: input.payerMsisdn ?? "",
      returnUrl: input.returnUrl ?? "",
      cancelUrl: input.returnUrl ?? "",
      notifUrl: input.webhookUrl ?? "",
      lang: "fr",
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error("Orange Money initiate failed", { status: res.status, errBody });
      throw AppError.provider("Orange Money payment initiation failed", {
        status: res.status,
        body: errBody,
      });
    }
    const data = (await res.json()) as {
      payToken?: string;
      redirectUrl?: string;
      payment_url?: string;
    };
    const providerTxId = data.payToken ?? ref;
    return {
      providerTransactionId: providerTxId,
      status: "pending",
      redirectUrl: data.redirectUrl ?? data.payment_url,
      raw: data,
    };
  },

  async checkStatus(transactionId: string): Promise<PaymentStatusOutput> {
    if (!orangeMoneyProvider.configured) {
      throw AppError.provider("Orange Money is not configured");
    }
    const token = await fetchAccessToken();
    const merchantKey = env("ORANGE_MONEY_MERCHANT_KEY")!;
    const url = `${getBaseUrl()}/orange-money-webpay/dev/v1/transaction-status?payToken=${encodeURIComponent(transactionId)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const errBody = await res.text();
      logger.error("Orange Money status fetch failed", { status: res.status, errBody });
      throw AppError.provider("Orange Money status check failed", { status: res.status });
    }
    const data = (await res.json()) as {
      status?: string;
      txn_error?: { message?: string };
    };
    const map: Record<string, PaymentStatusOutput["status"]> = {
      INITIATED: "pending",
      PENDING: "pending",
      SUCCESS: "succeeded",
      SUCCESSFUL: "succeeded",
      FAILED: "failed",
      CANCELLED: "failed",
      REFUNDED: "refunded",
    };
    return {
      status: map[data.status ?? ""] ?? "pending",
      providerTransactionId: transactionId,
      reason: data.txn_error?.message,
      raw: data,
    };
  },

  async verifyWebhook(req: Request): Promise<WebhookVerification> {
    const secret = env("PAYMENT_WEBHOOK_SECRET");
    const provided = req.headers.get("x-webhook-secret");
    if (!secret || provided !== secret) {
      return {
        valid: false,
        provider: "orange_money",
        providerTransactionId: "",
        status: "failed",
        raw: null,
      };
    }
    const body = (await req.json().catch(() => null)) as {
      payToken?: string;
      status?: string;
      amount?: string | number;
      currency?: string;
    } | null;
    const map: Record<string, WebhookVerification["status"]> = {
      INITIATED: "pending",
      PENDING: "pending",
      SUCCESS: "succeeded",
      SUCCESSFUL: "succeeded",
      FAILED: "failed",
      CANCELLED: "failed",
      REFUNDED: "refunded",
    };
    return {
      valid: true,
      provider: "orange_money",
      providerTransactionId: body?.payToken ?? "",
      status: map[body?.status ?? ""] ?? "pending",
      amount: body?.amount != null ? Number(body.amount) : undefined,
      currency: body?.currency,
      raw: body,
    };
  },
};
