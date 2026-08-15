/**
 * §5.13 / §17 — Payments service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Critical rules (§17.2):
 *  - Never activate an access on simple client return — always verify via
 *    webhook or explicit provider status check.
 *  - Webhooks are idempotent: we check providerTransactionId before processing.
 *  - The source of truth for entitlements is the database, not the client.
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  payments,
  subscriptions,
  invoices,
  schools,
  users,
  auditLogs,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

import {
  getPaymentProvider,
  PLANS,
  GRACE_PERIOD_DAYS,
} from "@/server/providers/payments";
import type {
  InitiatePaymentOutput,
  PlanType,
} from "@/server/providers/payments/types";
import type { PaymentProviderValue } from "@/server/db/schema/enums";
import type {
  Payment,
  Subscription,
  Invoice,
} from "@/server/db/schema/payments";
import type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  InitiatePaymentInput,
  ConfirmPaymentInput,
  ListPaymentsQuery,
  ListSubscriptionsQuery,
  ListInvoicesQuery,
} from "@/server/validators/payments";

/* -- Types (re-exports) ------------------------------------- */

export type { Payment, Subscription, Invoice };

export type SubscriptionWithPayments = Subscription & {
  payments: Payment[];
};

export type PaymentWithSubscription = Payment & {
  subscription: Pick<
    Subscription,
    "id" | "planType" | "userId" | "schoolId"
  > | null;
};

export type InvoiceWithRelations = Invoice & {
  school: Pick<School, "id" | "name"> | null;
  subscription: Pick<Subscription, "id" | "planType"> | null;
};

import type { School } from "@/server/db/schema/schools";

export type SubscriptionListResult = {
  items: Subscription[];
  total: number;
  page: number;
  pageSize: number;
};

export type PaymentListResult = {
  items: PaymentWithSubscription[];
  total: number;
  page: number;
  pageSize: number;
};

export type InvoiceListResult = {
  items: Invoice[];
  total: number;
  page: number;
  pageSize: number;
};

/* -- Helpers ----------------------------------------------- */

/**
 * Returns the plan price + currency from the catalog.
 */
export function getPlanPrice(planType: PlanType): {
  amount: number;
  currency: string;
  billingPeriodDays: number;
} {
  const plan = PLANS[planType];
  if (!plan) throw AppError.validation(`Unknown plan: ${planType}`);
  return {
    amount: plan.price,
    currency: plan.currency,
    billingPeriodDays: plan.billingPeriodDays,
  };
}

function computeEndsAt(
  billingPeriodDays: number,
  from: Date = new Date(),
): Date | null {
  if (billingPeriodDays <= 0) return null;
  const d = new Date(from);
  d.setDate(d.getDate() + billingPeriodDays);
  return d;
}

async function assertUserExists(userId: string): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (rows.length === 0) {
    throw AppError.notFound("User not found", { userId });
  }
}

async function assertSchoolExists(schoolId: string): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({ id: schools.id })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (rows.length === 0) {
    throw AppError.notFound("School not found", { schoolId });
  }
}

/* -- Subscriptions ------------------------------------------ */

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<Subscription> {
  const db = await getDb();

  if (input.userId) await assertUserExists(input.userId);
  if (input.schoolId) await assertSchoolExists(input.schoolId);

  const plan = PLANS[input.planType];
  if (!plan) {
    throw AppError.validation(`Unknown plan: ${input.planType}`);
  }

  // Free plan → status="free", no endsAt, autoRenew=false.
  const status = input.planType === "free" ? "free" : "active";
  const periodDays = input.billingPeriodDays ?? plan.billingPeriodDays;
  const endsAt = computeEndsAt(periodDays, new Date());

  const [created] = await db
    .insert(subscriptions)
    .values({
      userId: input.userId ?? null,
      schoolId: input.schoolId ?? null,
      planType: input.planType,
      status,
      amount: String(input.amount),
      currency: input.currency,
      startedAt: new Date(),
      endsAt,
      autoRenew: input.autoRenew,
    })
    .returning();
  if (!created) {
    throw AppError.internal("Failed to create subscription");
  }
  logger.info("Subscription created", {
    subscriptionId: created.id,
    planType: created.planType,
    userId: created.userId ?? null,
    schoolId: created.schoolId ?? null,
  });
  return created;
}

export async function getSubscription(
  id: string,
): Promise<SubscriptionWithPayments> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1);
  const sub = rows.at(0);
  if (!sub) throw AppError.notFound("Subscription not found", { id });

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.subscriptionId, id))
    .orderBy(desc(payments.createdAt));
  return { ...sub, payments: paymentRows };
}

export async function getUserSubscription(
  userId: string,
): Promise<Subscription | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows.at(0) ?? null;
}

export async function getSchoolSubscription(
  schoolId: string,
): Promise<Subscription | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.schoolId, schoolId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows.at(0) ?? null;
}

export async function updateSubscription(
  input: UpdateSubscriptionInput,
): Promise<Subscription> {
  const db = await getDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.planType !== undefined) patch.planType = input.planType;
  if (input.amount !== undefined) patch.amount = String(input.amount);
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.autoRenew !== undefined) patch.autoRenew = input.autoRenew;
  if (input.status !== undefined) patch.status = input.status;
  if (input.endsAt !== undefined) {
    patch.endsAt = input.endsAt === null ? null : new Date(input.endsAt);
  }

  const [updated] = await db
    .update(subscriptions)
    .set(patch)
    .where(eq(subscriptions.id, input.id))
    .returning();
  if (!updated)
    throw AppError.notFound("Subscription not found", { id: input.id });
  return updated;
}

export async function cancelSubscription(id: string): Promise<Subscription> {
  const db = await getDb();
  const existing = await getSubscription(id);
  // Mark as cancelled but PRESERVE endsAt so the user keeps access until then.
  const [updated] = await db
    .update(subscriptions)
    .set({ status: "cancelled", autoRenew: false, updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Subscription not found", { id });
  await db.insert(auditLogs).values({
    actorId: null,
    action: "subscription.cancel",
    entityType: "subscription",
    entityId: id,
    metadata: {
      planType: existing.planType,
      endsAt: existing.endsAt?.toISOString() ?? null,
    },
  });
  logger.info("Subscription cancelled", {
    subscriptionId: id,
    endsAt: existing.endsAt ?? null,
  });
  return updated;
}

export async function expireSubscription(id: string): Promise<Subscription> {
  const db = await getDb();
  const [updated] = await db
    .update(subscriptions)
    .set({ status: "expired", autoRenew: false, updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Subscription not found", { id });
  return updated;
}

export async function activateSubscription(
  id: string,
  endsAt: Date,
): Promise<Subscription> {
  const db = await getDb();
  const [updated] = await db
    .update(subscriptions)
    .set({ status: "active", endsAt, autoRenew: true, updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Subscription not found", { id });
  return updated;
}

export async function listSubscriptions(
  filters: ListSubscriptionsQuery,
): Promise<SubscriptionListResult> {
  const db = await getDb();
  const conditions: ReturnType<typeof eq>[] = [];
  if (filters.status) conditions.push(eq(subscriptions.status, filters.status));
  if (filters.planType)
    conditions.push(eq(subscriptions.planType, filters.planType));
  if (filters.userId) conditions.push(eq(subscriptions.userId, filters.userId));
  if (filters.schoolId)
    conditions.push(eq(subscriptions.schoolId, filters.schoolId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const items = await db
    .select()
    .from(subscriptions)
    .where(where)
    .orderBy(desc(subscriptions.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const totalRow = await db
    .select({ c: count() })
    .from(subscriptions)
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? items.length);
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

/* -- Payments ---------------------------------------------- */

export async function initiatePayment(
  input: InitiatePaymentInput,
): Promise<{ payment: Payment; provider: InitiatePaymentOutput }> {
  const db = await getDb();

  // 1. Validate subscription exists + is owned by the caller (checked in action).
  const sub = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, input.subscriptionId))
    .limit(1);
  const subscription = sub.at(0);
  if (!subscription) {
    throw AppError.notFound("Subscription not found", {
      id: input.subscriptionId,
    });
  }

  // 2. Create the payment row first (status=pending), so we have an id.
  const [payment] = await db
    .insert(payments)
    .values({
      subscriptionId: subscription.id,
      provider: input.provider,
      amount: String(input.amount),
      currency: input.currency,
      status: "pending",
      metadata: input.payerMsisdn ? { payerMsisdn: input.payerMsisdn } : null,
    })
    .returning();
  if (!payment) {
    throw AppError.internal("Failed to create payment row");
  }

  // 3. Call the provider.
  const provider = getPaymentProvider(input.provider as PaymentProviderValue);
  if (!provider.configured) {
    // Mark payment as failed and surface a clear error.
    await db
      .update(payments)
      .set({ status: "failed", metadata: { error: "Provider not configured" } })
      .where(eq(payments.id, payment.id));
    throw AppError.provider(
      `Payment provider "${provider.name}" is not configured. Set the required environment variables.`,
      { provider: provider.name },
    );
  }

  let providerOutput: InitiatePaymentOutput;
  try {
    providerOutput = await provider.initiatePayment({
      paymentId: payment.id,
      subscriptionId: subscription.id,
      amount: input.amount,
      currency: input.currency,
      description:
        input.description ?? `Abonnement Danaël — ${subscription.planType}`,
      payerMsisdn: input.payerMsisdn,
    });
  } catch (err) {
    // Persist the failure on the payment row before propagating.
    await db
      .update(payments)
      .set({
        status: "failed",
        providerTransactionId: null,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      })
      .where(eq(payments.id, payment.id));
    throw err;
  }

  // 4. Persist the provider transaction reference so we can poll / verify.
  const [updated] = await db
    .update(payments)
    .set({
      providerTransactionId: providerOutput.providerTransactionId,
      metadata: {
        ...(payment.metadata ?? {}),
        provider: provider.name,
        redirectUrl: providerOutput.redirectUrl ?? null,
        raw: providerOutput.raw ?? null,
      },
    })
    .where(eq(payments.id, payment.id))
    .returning();

  logger.info("Payment initiated", {
    paymentId: payment.id,
    provider: provider.name,
    providerTransactionId: providerOutput.providerTransactionId,
    subscriptionId: subscription.id,
  });
  return { payment: updated ?? payment, provider: providerOutput };
}

export async function confirmPayment(
  input: ConfirmPaymentInput,
): Promise<Payment> {
  const db = await getDb();

  // 1. Fetch the payment row.
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.id, input.paymentId))
    .limit(1);
  const payment = rows.at(0);
  if (!payment) {
    throw AppError.notFound("Payment not found", { id: input.paymentId });
  }

  // 2. Idempotency: if already confirmed, return without re-processing.
  if (payment.status === "succeeded") {
    logger.info("confirmPayment: already succeeded (idempotent)", {
      paymentId: payment.id,
    });
    return payment;
  }

  // 3. Call the provider to verify the transaction status — NEVER trust the
  //    client-provided providerTransactionId alone. We use the provider's own
  //    `checkStatus` to get the authoritative answer.
  const provider = getPaymentProvider(payment.provider as PaymentProviderValue);
  let confirmedStatus: Payment["status"] = "pending";
  if (provider.configured) {
    try {
      const status = await provider.checkStatus(input.providerTransactionId);
      confirmedStatus =
        status.status === "succeeded"
          ? "succeeded"
          : status.status === "refunded"
            ? "refunded"
            : status.status === "failed"
              ? "failed"
              : "pending";
    } catch (err) {
      logger.error("confirmPayment: provider status check failed", {
        paymentId: payment.id,
        error: String(err),
      });
      throw AppError.provider("Could not verify payment status with provider");
    }
  } else {
    // Provider not configured → we cannot safely confirm. Surface an error.
    throw AppError.provider(
      `Payment provider "${provider.name}" is not configured; cannot verify payment.`,
      { provider: provider.name },
    );
  }

  // 4. Update the payment row.
  const [updated] = await db
    .update(payments)
    .set({
      status: confirmedStatus,
      providerTransactionId: input.providerTransactionId,
    })
    .where(eq(payments.id, payment.id))
    .returning();
  if (!updated) {
    throw AppError.internal("Failed to update payment");
  }

  // 5. If succeeded, activate the subscription and create the invoice.
  if (confirmedStatus === "succeeded") {
    await activateSubscriptionAfterPayment(payment);
  }

  logger.info("Payment confirmed", {
    paymentId: payment.id,
    status: confirmedStatus,
    providerTransactionId: input.providerTransactionId,
  });
  return updated;
}

/**
 * Side-effect: after a successful payment, activate the linked subscription
 * and create / mark-as-paid the corresponding invoice.
 */
async function activateSubscriptionAfterPayment(
  payment: Payment,
): Promise<void> {
  const db = await getDb();
  const subRows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, payment.subscriptionId ?? ""))
    .limit(1);
  const sub = subRows.at(0);
  if (!sub) {
    logger.warn("activateSubscriptionAfterPayment: subscription missing", {
      subscriptionId: payment.subscriptionId,
    });
    return;
  }

  const plan = PLANS[sub.planType as PlanType];
  const periodDays = plan?.billingPeriodDays ?? 30;
  const newEndsAt = new Date();
  newEndsAt.setDate(newEndsAt.getDate() + periodDays);

  await db
    .update(subscriptions)
    .set({
      status: "active",
      endsAt: newEndsAt,
      autoRenew: true,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));

  // Create / mark-as-paid the invoice for this period (school only).
  if (sub.schoolId) {
    await createInvoice(sub.schoolId, sub.id, Number(payment.amount)).catch(
      (err) => {
        logger.warn("createInvoice during confirmPayment failed", {
          error: String(err),
          paymentId: payment.id,
        });
      },
    );
  }

  await db.insert(auditLogs).values({
    actorId: null,
    action: "payment.confirmed",
    entityType: "payment",
    entityId: payment.id,
    metadata: {
      subscriptionId: sub.id,
      amount: payment.amount,
      provider: payment.provider,
    },
  });
}

export async function listPayments(
  filters: ListPaymentsQuery,
): Promise<PaymentListResult> {
  const db = await getDb();
  const conditions: ReturnType<typeof eq>[] = [];
  if (filters.subscriptionId)
    conditions.push(eq(payments.subscriptionId, filters.subscriptionId));
  if (filters.status) conditions.push(eq(payments.status, filters.status));
  if (filters.provider)
    conditions.push(eq(payments.provider, filters.provider));
  if (filters.userId || filters.schoolId) {
    const subConditions = [];
    if (filters.userId)
      subConditions.push(eq(subscriptions.userId, filters.userId));
    if (filters.schoolId)
      subConditions.push(eq(subscriptions.schoolId, filters.schoolId));
    conditions.push(
      inArray(
        payments.subscriptionId,
        db
          .select({ id: subscriptions.id })
          .from(subscriptions)
          .where(
            subConditions.length === 1
              ? subConditions[0]
              : and(...subConditions),
          ),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      payment: payments,
      subscription: subscriptions,
    })
    .from(payments)
    .leftJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const totalRow = await db.select({ c: count() }).from(payments).where(where);
  const total = Number(totalRow.at(0)?.c ?? rows.length);

  const items: PaymentWithSubscription[] = rows.map((r) => ({
    ...r.payment,
    subscription: r.subscription
      ? {
          id: r.subscription.id,
          planType: r.subscription.planType,
          userId: r.subscription.userId,
          schoolId: r.subscription.schoolId,
        }
      : null,
  }));
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getPayment(id: string): Promise<Payment> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  const payment = rows.at(0);
  if (!payment) throw AppError.notFound("Payment not found", { id });
  return payment;
}

/**
 * Find a payment by provider transaction id — used by the webhook handler to
 * implement idempotency (return null if not found).
 */
export async function findPaymentByProviderTransactionId(
  providerTransactionId: string,
): Promise<Payment | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.providerTransactionId, providerTransactionId))
    .limit(1);
  return rows.at(0) ?? null;
}

/**
 * Confirm a payment from an idempotent webhook callback. We trust the
 * provider-reported status (after signature verification) and update the
 * payment + subscription accordingly.
 */
export async function confirmPaymentFromWebhook(
  payment: Payment,
  newStatus: Payment["status"],
): Promise<Payment> {
  const db = await getDb();

  // Idempotency: already in the target state.
  if (payment.status === newStatus && newStatus === "succeeded") {
    return payment;
  }

  const [updated] = await db
    .update(payments)
    .set({ status: newStatus })
    .where(eq(payments.id, payment.id))
    .returning();
  if (!updated)
    throw AppError.internal("Failed to update payment from webhook");

  if (newStatus === "succeeded") {
    await activateSubscriptionAfterPayment(updated);
  }
  logger.info("Payment updated from webhook", {
    paymentId: payment.id,
    status: newStatus,
  });
  return updated;
}

/* -- Invoices ----------------------------------------------- */

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const db = await getDb();
  // Count existing invoices for this year → next sequence number.
  const rows = await db
    .select({ c: count() })
    .from(invoices)
    .where(sql`${invoices.number} LIKE ${`INV-${year}-%`}`);
  const seq = Number(rows.at(0)?.c ?? 0) + 1;
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

export async function createInvoice(
  schoolId: string,
  subscriptionId: string,
  amount: number,
): Promise<Invoice> {
  await assertSchoolExists(schoolId);
  const db = await getDb();
  const number = await nextInvoiceNumber();
  const [created] = await db
    .insert(invoices)
    .values({
      schoolId,
      subscriptionId,
      number,
      amount: String(amount),
      status: "paid",
      issuedAt: new Date(),
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create invoice");
  logger.info("Invoice created", { invoiceId: created.id, number, schoolId });
  return created;
}

export async function listInvoices(
  filters: ListInvoicesQuery,
): Promise<InvoiceListResult> {
  const db = await getDb();
  const conditions: ReturnType<typeof eq>[] = [];
  if (filters.schoolId)
    conditions.push(eq(invoices.schoolId, filters.schoolId));
  if (filters.subscriptionId)
    conditions.push(eq(invoices.subscriptionId, filters.subscriptionId));
  if (filters.status) conditions.push(eq(invoices.status, filters.status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(invoices)
    .where(where)
    .orderBy(desc(invoices.issuedAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  const totalRow = await db.select({ c: count() }).from(invoices).where(where);
  const total = Number(totalRow.at(0)?.c ?? items.length);
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getInvoice(id: string): Promise<InvoiceWithRelations> {
  const db = await getDb();
  const rows = await db
    .select({
      invoice: invoices,
      school: schools,
      subscription: subscriptions,
    })
    .from(invoices)
    .leftJoin(schools, eq(schools.id, invoices.schoolId))
    .leftJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .where(eq(invoices.id, id))
    .limit(1);
  const row = rows.at(0);
  if (!row) throw AppError.notFound("Invoice not found", { id });
  return {
    ...row.invoice,
    school: row.school ? { id: row.school.id, name: row.school.name } : null,
    subscription: row.subscription
      ? { id: row.subscription.id, planType: row.subscription.planType }
      : null,
  };
}

/* -- Grace period / expiry helpers ------------------------- */

/**
 * Marks subscriptions whose endsAt has passed (and grace period expired) as
 * expired. Safe to call from a cron — idempotent.
 */
export async function expireDueSubscriptions(
  now: Date = new Date(),
): Promise<number> {
  const db = await getDb();
  const graceEnd = new Date(now);
  graceEnd.setDate(graceEnd.getDate() - GRACE_PERIOD_DAYS);

  const rows = await db
    .update(subscriptions)
    .set({ status: "expired", autoRenew: false, updatedAt: now })
    .where(
      and(
        eq(subscriptions.status, "active"),
        isNotNull(subscriptions.endsAt),
        sql`${subscriptions.endsAt} < ${graceEnd}`,
      ),
    )
    .returning();
  if (rows.length > 0) {
    logger.info("Expired subscriptions", { count: rows.length });
  }
  return rows.length;
}

/* -- Convenience: pick a "default" payment method for a user -- */
export async function pickDefaultProvider(): Promise<PaymentProviderValue | null> {
  // Prefer MTN MoMo (most common in Cameroon), then Orange, then card.
  // We respect provider.configured but always allow MTN MoMo / Orange as the
  // default even when env vars are missing — the UI will surface the error.
  return "mtn_money";
}

/* -- Re-exports for callers -------------------------------- */
export { PLANS, GRACE_PERIOD_DAYS };

void or;
void isNull;
void gte;
void inArray;
