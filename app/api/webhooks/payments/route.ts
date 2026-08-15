/**
 * §17.2 — Payment webhook route.
 *
 * Handles payment confirmations from MTN MoMo, Orange Money, and Stripe.
 *
 * Security:
 *  - Webhook signature is verified via PAYMENT_WEBHOOK_SECRET (header
 *    `x-webhook-secret`). Each provider also implements its own verification.
 *  - The handler is IDEMPOTENT: if the same providerTransactionId has already
 *    been processed (payment.status === "succeeded"), we return 200 without
 *    re-processing.
 *  - We NEVER activate an access on simple client return — the webhook is the
 *    only path that activates subscriptions.
 */

import { getDb } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { logger } from "@/lib/logger";
import {
  getPaymentProvider,
  type WebhookVerification,
} from "@/server/providers/payments";
import type { PaymentProviderValue } from "@/server/db/schema/enums";
import * as paymentsService from "@/server/services/payments";
import type { Payment } from "@/server/db/schema/payments";

/**
 * The provider name is encoded in the `provider` query string so we can route
 * to the correct verifier. (e.g. /api/webhooks/payments?provider=mtn_money)
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const providerParam = url.searchParams.get(
    "provider",
  ) as PaymentProviderValue | null;

  if (!providerParam) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing 'provider' query parameter",
        },
      },
      { status: 400 },
    );
  }

  let provider;
  try {
    provider = getPaymentProvider(providerParam);
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Unknown provider: ${providerParam}`,
        },
      },
      { status: 400 },
    );
  }

  // 1. Verify the webhook (signature + parse body).
  let verification: WebhookVerification;
  try {
    verification = await provider.verifyWebhook(req);
  } catch (err) {
    logger.error("Webhook verify threw", {
      provider: provider.name,
      error: String(err),
    });
    return Response.json(
      {
        success: false,
        error: {
          code: "PROVIDER_ERROR",
          message: "Webhook verification failed",
        },
      },
      { status: 400 },
    );
  }

  if (!verification.valid) {
    logger.warn("Webhook signature invalid", { provider: provider.name });
    return Response.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid webhook signature" },
      },
      { status: 401 },
    );
  }

  // 2. Find the payment by providerTransactionId (idempotency key).
  if (!verification.providerTransactionId) {
    logger.warn("Webhook missing providerTransactionId", {
      provider: provider.name,
    });
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing providerTransactionId",
        },
      },
      { status: 400 },
    );
  }

  try {
    const payment = await paymentsService.findPaymentByProviderTransactionId(
      verification.providerTransactionId,
    );

    if (!payment) {
      // Could be a payment initiated outside the app — log and ack so the
      // provider doesn't keep retrying.
      logger.warn("Webhook: payment not found for transaction", {
        provider: provider.name,
        providerTransactionId: verification.providerTransactionId,
      });
      await logWebhook(provider.name, verification, null, "payment_not_found");
      return Response.json({
        success: true,
        data: { ack: true, reason: "payment_not_found" },
      });
    }

    // Idempotency: if already succeeded, ack without re-processing.
    if (payment.status === "succeeded" && verification.status === "succeeded") {
      logger.info("Webhook idempotent re-play", { paymentId: payment.id });
      await logWebhook(
        provider.name,
        verification,
        payment,
        "already_succeeded",
      );
      return Response.json({
        success: true,
        data: { ack: true, reason: "already_succeeded" },
      });
    }

    // 3. Map provider status → DB status.
    const newStatus: Payment["status"] =
      verification.status === "succeeded"
        ? "succeeded"
        : verification.status === "refunded"
          ? "refunded"
          : verification.status === "failed"
            ? "failed"
            : "pending";

    // 4. Cross-check amount if the provider sent one back.
    if (
      verification.amount !== undefined &&
      Number(payment.amount) !== verification.amount
    ) {
      logger.error("Webhook amount mismatch", {
        paymentId: payment.id,
        expected: payment.amount,
        received: verification.amount,
      });
      await logWebhook(provider.name, verification, payment, "amount_mismatch");
      // Fail the payment to flag the dispute.
      await paymentsService.confirmPaymentFromWebhook(payment, "failed");
      return Response.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: "Amount mismatch — payment flagged",
          },
        },
        { status: 409 },
      );
    }

    // 5. Update payment + activate subscription (side-effect).
    const updated = await paymentsService.confirmPaymentFromWebhook(
      payment,
      newStatus,
    );
    await logWebhook(
      provider.name,
      verification,
      updated,
      `status_${newStatus}`,
    );

    logger.info("Webhook processed", {
      paymentId: updated.id,
      provider: provider.name,
      status: newStatus,
    });

    return Response.json({
      success: true,
      data: { paymentId: updated.id, status: newStatus },
    });
  } catch (err) {
    logger.error("Webhook handler failed", {
      provider: provider.name,
      providerTransactionId: verification.providerTransactionId,
      error: String(err),
    });
    return Response.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Webhook processing failed" },
      },
      { status: 500 },
    );
  }
}

/**
 * GET handler — returns 200 so external monitors can verify the endpoint.
 */
export async function GET() {
  return Response.json({
    success: true,
    data: { service: "payments-webhook", methods: ["POST"] },
  });
}

/* -- Helpers ----------------------------------------------- */

async function logWebhook(
  provider: string,
  verification: WebhookVerification,
  payment: Payment | null,
  outcome: string,
): Promise<void> {
  const db = await getDb();
  try {
    await db.insert(auditLogs).values({
      actorId: null,
      action: `webhook.payment.${provider}`,
      entityType: "payment",
      entityId: payment?.id ?? verification.providerTransactionId,
      metadata: {
        provider,
        outcome,
        status: verification.status,
        providerTransactionId: verification.providerTransactionId,
        amount: verification.amount ?? null,
        currency: verification.currency ?? null,
      },
    });
  } catch (err) {
    logger.warn("Failed to log webhook event", { error: String(err) });
  }
}
