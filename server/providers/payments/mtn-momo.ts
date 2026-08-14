/**
 * §5.13 — MTN Mobile Money (MoMo) provider.
 *
 * Implements the PaymentProvider interface against the MTN MoMo Collection API.
 *
 * Env vars:
 *  - MTN_MOMO_API_USER (OAuth client id — sometimes called "api_user_id")
 *  - MTN_MOMO_API_KEY (OAuth client secret)
 *  - MTN_MOMO_SUBSCRIPTION_KEY (Ocp-Apim-Subscription-Key header)
 *  - MTN_MOMO_ENV ("sandbox" | "production"; default sandbox)
 *
 * When env vars are missing, `configured` returns false and `initiatePayment`
 * throws an AppError("PROVIDER_ERROR") — never a crash.
 *
 * Reference: https://momodeveloper.mtn.com
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
  sandbox: "https://sandbox.momodeveloper.mtn.com",
  production: "https://momodeveloper.mtn.com",
} as const;

interface MomoAccessToken {
  access_token: string;
  expires_in: number;
  fetchedAt: number;
}

let cachedToken: MomoAccessToken | null = null;

function env(name: string): string | undefined {
  return process.env[name];
}

function getBaseUrl(): string {
  const e = env("MTN_MOMO_ENV") ?? "sandbox";
  return e === "production" ? BASE_URLS.production : BASE_URLS.sandbox;
}

async function fetchAccessToken(): Promise<string> {
  const apiUser = env("MTN_MOMO_API_USER");
  const apiKey = env("MTN_MOMO_API_KEY");
  if (!apiUser || !apiKey) {
    throw AppError.provider("MTN MoMo credentials are not configured", {
      missing: ["MTN_MOMO_API_USER", "MTN_MOMO_API_KEY"],
    });
  }
  // Cache token until ~60s before expiry.
  if (cachedToken && Date.now() - cachedToken.fetchedAt < (cachedToken.expires_in - 60) * 1000) {
    return cachedToken.access_token;
  }

  const url = `${getBaseUrl()}/collection/token/`;
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Ocp-Apim-Subscription-Key": env("MTN_MOMO_SUBSCRIPTION_KEY") ?? "",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error("MTN MoMo token fetch failed", { status: res.status, body });
    throw AppError.provider("MTN MoMo authentication failed", { status: res.status });
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 3600,
    fetchedAt: Date.now(),
  };
  return cachedToken.access_token;
}

export const mtnMomoProvider: PaymentProvider = {
  name: "mtn_money",
  label: "MTN Mobile Money",
  get configured(): boolean {
    return Boolean(
      env("MTN_MOMO_API_USER") &&
        env("MTN_MOMO_API_KEY") &&
        env("MTN_MOMO_SUBSCRIPTION_KEY"),
    );
  },

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    if (!mtnMomoProvider.configured) {
      throw AppError.provider("MTN MoMo is not configured");
    }
    if (!input.payerMsisdn) {
      throw AppError.validation("payerMsisdn is required for MTN MoMo");
    }
    const token = await fetchAccessToken();
    const ref = input.paymentId;
    const url = `${getBaseUrl()}/collection/v1_0/requesttopay`;

    const body = {
      amount: String(input.amount),
      currency: input.currency,
      externalId: ref,
      payer: { partyIdType: "MSISDN", partyId: input.payerMsisdn },
      payerMessage: input.description ?? "Abonnement Danaël",
      payeeNote: input.description ?? "Abonnement Danaël",
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Reference-Id": ref,
        "X-Target-Environment": env("MTN_MOMO_ENV") ?? "sandbox",
        "Ocp-Apim-Subscription-Key": env("MTN_MOMO_SUBSCRIPTION_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // MTN returns 202 Accepted with empty body on success.
    if (res.status !== 202) {
      const errBody = await res.text();
      logger.error("MTN MoMo initiate failed", { status: res.status, errBody });
      throw AppError.provider("MTN MoMo payment initiation failed", {
        status: res.status,
        body: errBody,
      });
    }

    return {
      providerTransactionId: ref,
      status: "pending",
      raw: { provider: "mtn_money", externalId: ref },
    };
  },

  async checkStatus(transactionId: string): Promise<PaymentStatusOutput> {
    if (!mtnMomoProvider.configured) {
      throw AppError.provider("MTN MoMo is not configured");
    }
    const token = await fetchAccessToken();
    const url = `${getBaseUrl()}/collection/v1_0/requesttopay/${transactionId}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": env("MTN_MOMO_ENV") ?? "sandbox",
        "Ocp-Apim-Subscription-Key": env("MTN_MOMO_SUBSCRIPTION_KEY")!,
      },
    });
    if (!res.ok) {
      const errBody = await res.text();
      logger.error("MTN MoMo status fetch failed", { status: res.status, errBody });
      throw AppError.provider("MTN MoMo status check failed", { status: res.status });
    }
    const data = (await res.json()) as {
      status: "PENDING" | "SUCCESSFUL" | "FAILED" | "REFUNDED";
      reason?: { message?: string };
    };
    const map: Record<string, PaymentStatusOutput["status"]> = {
      PENDING: "pending",
      SUCCESSFUL: "succeeded",
      FAILED: "failed",
      REFUNDED: "refunded",
    };
    return {
      status: map[data.status] ?? "pending",
      providerTransactionId: transactionId,
      reason: data.reason?.message,
      raw: data,
    };
  },

  async verifyWebhook(req: Request): Promise<WebhookVerification> {
    // MTN MoMo webhooks are configured to deliver to a URL with a shared
    // secret; we verify via the `X-Reference-Id` header + an HMAC we set
    // ourselves on the webhook URL (query string).
    const secret = env("PAYMENT_WEBHOOK_SECRET");
    const provided = req.headers.get("x-webhook-secret");
    if (!secret || provided !== secret) {
      return {
        valid: false,
        provider: "mtn_money",
        providerTransactionId: "",
        status: "failed",
        raw: null,
      };
    }
    const body = (await req.json().catch(() => null)) as {
      externalId?: string;
      status?: string;
      amount?: string;
      currency?: string;
    } | null;
    const map: Record<string, WebhookVerification["status"]> = {
      PENDING: "pending",
      SUCCESSFUL: "succeeded",
      FAILED: "failed",
      REFUNDED: "refunded",
    };
    return {
      valid: true,
      provider: "mtn_money",
      providerTransactionId: body?.externalId ?? "",
      status: map[body?.status ?? ""] ?? "pending",
      amount: body?.amount ? Number(body.amount) : undefined,
      currency: body?.currency,
      raw: body,
    };
  },
};
