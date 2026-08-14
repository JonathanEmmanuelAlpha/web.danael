"use server";

/**
 * §5.13 / §17 — Payments server actions.
 *
 * Wraps the payments service + entitlements with auth + RBAC + Zod validation.
 * Each action returns a typed ApiResponse<T>.
 *
 * Authorization rules:
 *  - createSubscription → any authenticated user (for self) OR platform_admin
 *    (for school / others).
 *  - cancelSubscription → owner (self or school admin) or platform_admin.
 *  - initiatePayment → owner or school admin.
 *  - confirmPayment → system-only via webhook; actions also allowed for owner
 *    (with re-check) and platform_admin.
 *  - getEntitlements → self (or platform_admin for any user).
 *  - listInvoices / listPayments → owner, school admin, or platform_admin.
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isSchoolMember } from "@/server/permissions";
import { requireRole } from "@/server/permissions/context";

import * as paymentsService from "@/server/services/payments";
import * as entitlementsService from "@/server/services/entitlements";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  cancelSubscriptionSchema,
  initiatePaymentSchema,
  confirmPaymentSchema,
  listPaymentsQuerySchema,
  listSubscriptionsQuerySchema,
  listInvoicesQuerySchema,
  getInvoiceSchema,
  canAccessFeatureSchema,
  type CreateSubscriptionInput,
  type UpdateSubscriptionInput,
  type CancelSubscriptionInput,
  type InitiatePaymentInput,
  type ConfirmPaymentInput,
  type ListPaymentsQuery,
  type ListSubscriptionsQuery,
  type ListInvoicesQuery,
  type GetInvoiceInput,
  type CanAccessFeatureInput,
} from "@/server/validators/payments";
import type {
  Subscription,
  Payment,
  Invoice,
  SubscriptionWithPayments,
  PaymentWithSubscription,
  InvoiceWithRelations,
} from "@/server/services/payments";
import type { EntitlementResult, PlanDefinition } from "@/server/services/entitlements";
import type { PlanType } from "@/server/providers/payments/types";

/* ── Helpers ─────────────────────────────────────────────── */

async function requireDbUserOrThrow() {
  await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    throw AppError.notFound("User profile not found. Please complete onboarding.");
  }
  return dbUser;
}

function handleErr(err: unknown, label: string): ApiResponse<never> {
  if (err instanceof AppError) {
    return { success: false, error: { code: err.code, message: err.message } };
  }
  logger.error(`${label} failed`, { error: String(err) });
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Could not complete the request" },
  };
}

/**
 * Verify the current user is allowed to act on a subscription:
 *  - their own subscription, OR
 *  - school admin of the subscription's school, OR
 *  - platform admin.
 */
async function requireSubscriptionOwnerOrAdmin(
  subscriptionId: string,
): Promise<{ userId: string; subscription: Subscription }> {
  const dbUser = await requireDbUserOrThrow();
  const sub = await paymentsService.getSubscription(subscriptionId);
  if (sub.userId === dbUser.id) {
    return { userId: dbUser.id, subscription: sub };
  }
  if (sub.schoolId) {
    const ok = await isSchoolMember(dbUser.id, sub.schoolId);
    if (ok && (dbUser.role === "school_admin" || dbUser.role === "platform_admin")) {
      return { userId: dbUser.id, subscription: sub };
    }
  }
  if (dbUser.role === "platform_admin") {
    return { userId: dbUser.id, subscription: sub };
  }
  throw AppError.forbidden("You are not authorized to act on this subscription");
}

/* ── Subscriptions ───────────────────────────────────────── */

export async function createSubscriptionAction(
  input: CreateSubscriptionInput,
): Promise<ApiResponse<Subscription>> {
  try {
    const dbUser = await requireDbUserOrThrow();

    const parsed = createSubscriptionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const data = parsed.data;

    // Only platform_admin can create subscriptions for other users / schools.
    if (data.userId && data.userId !== dbUser.id && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You can only create subscriptions for yourself");
    }
    if (data.schoolId && dbUser.role !== "platform_admin") {
      const ok = await isSchoolMember(dbUser.id, data.schoolId);
      if (!ok) {
        throw AppError.forbidden("You are not a member of this school");
      }
      if (dbUser.role !== "school_admin") {
        throw AppError.unauthorized("Only school admins can manage school subscriptions");
      }
    }
    // If userId not provided, default to current user.
    if (!data.userId && !data.schoolId) {
      data.userId = dbUser.id;
    }

    const sub = await paymentsService.createSubscription(data);
    revalidatePath("/billing");
    revalidatePath("/admin/subscriptions");
    return { success: true, data: sub };
  } catch (err) {
    return handleErr(err, "createSubscriptionAction");
  }
}

export async function getSubscriptionAction(
  id: string,
): Promise<ApiResponse<SubscriptionWithPayments>> {
  try {
    await requireSubscriptionOwnerOrAdmin(id);
    const sub = await paymentsService.getSubscription(id);
    return { success: true, data: sub };
  } catch (err) {
    return handleErr(err, "getSubscriptionAction");
  }
}

export async function getMySubscriptionAction(): Promise<ApiResponse<Subscription | null>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const sub = await paymentsService.getUserSubscription(dbUser.id);
    return { success: true, data: sub };
  } catch (err) {
    return handleErr(err, "getMySubscriptionAction");
  }
}

export async function getSchoolSubscriptionAction(
  schoolId: string,
): Promise<ApiResponse<Subscription | null>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const ok = await isSchoolMember(dbUser.id, schoolId);
    if (!ok && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You are not a member of this school");
    }
    const sub = await paymentsService.getSchoolSubscription(schoolId);
    return { success: true, data: sub };
  } catch (err) {
    return handleErr(err, "getSchoolSubscriptionAction");
  }
}

export async function cancelSubscriptionAction(
  input: CancelSubscriptionInput,
): Promise<ApiResponse<Subscription>> {
  try {
    await requireSubscriptionOwnerOrAdmin(input.id);
    const parsed = cancelSubscriptionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const sub = await paymentsService.cancelSubscription(parsed.data.id);
    revalidatePath("/billing");
    revalidatePath("/admin/subscriptions");
    return { success: true, data: sub };
  } catch (err) {
    return handleErr(err, "cancelSubscriptionAction");
  }
}

export async function updateSubscriptionAction(
  input: UpdateSubscriptionInput,
): Promise<ApiResponse<Subscription>> {
  try {
    await requireSubscriptionOwnerOrAdmin(input.id);
    const parsed = updateSubscriptionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const sub = await paymentsService.updateSubscription(parsed.data);
    revalidatePath("/billing");
    revalidatePath("/admin/subscriptions");
    return { success: true, data: sub };
  } catch (err) {
    return handleErr(err, "updateSubscriptionAction");
  }
}

/* ── Payments ─────────────────────────────────────────────── */

export async function initiatePaymentAction(
  input: InitiatePaymentInput,
): Promise<
  ApiResponse<{ payment: Payment; providerTransactionId: string; redirectUrl?: string }>
> {
  try {
    await requireSubscriptionOwnerOrAdmin(input.subscriptionId);

    const parsed = initiatePaymentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const data = parsed.data;

    // Mobile Money flows require a payer phone number.
    if (
      (data.provider === "mtn_money" || data.provider === "orange_money") &&
      !data.payerMsisdn
    ) {
      throw AppError.validation("payerMsisdn is required for Mobile Money payments");
    }

    const { payment, provider } = await paymentsService.initiatePayment(data);
    revalidatePath("/billing");
    revalidatePath("/admin/payments");
    return {
      success: true,
      data: {
        payment,
        providerTransactionId: provider.providerTransactionId,
        redirectUrl: provider.redirectUrl,
      },
    };
  } catch (err) {
    return handleErr(err, "initiatePaymentAction");
  }
}

export async function confirmPaymentAction(
  input: ConfirmPaymentInput,
): Promise<ApiResponse<Payment>> {
  try {
    // confirmPayment is called from webhook (system) OR from client after a
    // redirect-back. We allow authenticated users, but always re-verify with
    // the provider — never trust the client.
    await requireSession();
    const parsed = confirmPaymentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const payment = await paymentsService.confirmPayment(parsed.data);
    revalidatePath("/billing");
    revalidatePath("/admin/payments");
    return { success: true, data: payment };
  } catch (err) {
    return handleErr(err, "confirmPaymentAction");
  }
}

export async function listPaymentsAction(
  filters: ListPaymentsQuery,
): Promise<ApiResponse<{ items: PaymentWithSubscription[]; total: number; page: number; pageSize: number }>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const parsed = listPaymentsQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const data = parsed.data;

    // Non-admins can only see their own payments.
    if (dbUser.role !== "platform_admin") {
      data.userId = dbUser.id;
      data.schoolId = undefined; // school admins use the dedicated action below
    }
    const result = await paymentsService.listPayments(data);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listPaymentsAction");
  }
}

export async function listSchoolPaymentsAction(
  schoolId: string,
  page = 1,
  pageSize = 20,
): Promise<ApiResponse<{ items: PaymentWithSubscription[]; total: number; page: number; pageSize: number }>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const ok = await isSchoolMember(dbUser.id, schoolId);
    if (!ok && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You are not a member of this school");
    }
    const result = await paymentsService.listPayments({ schoolId, page, pageSize });
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listSchoolPaymentsAction");
  }
}

export async function listMyPaymentsAction(
  page = 1,
  pageSize = 20,
): Promise<ApiResponse<{ items: PaymentWithSubscription[]; total: number; page: number; pageSize: number }>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const result = await paymentsService.listPayments({ userId: dbUser.id, page, pageSize });
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listMyPaymentsAction");
  }
}

export async function getPaymentAction(
  id: string,
): Promise<ApiResponse<Payment>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const payment = await paymentsService.getPayment(id);

    // Authorization: user must own the payment (via subscription) OR be admin.
    if (dbUser.role !== "platform_admin") {
      if (!payment.subscriptionId) {
        throw AppError.forbidden("You cannot access this payment");
      }
      const sub = await paymentsService.getSubscription(payment.subscriptionId);
      if (sub.userId !== dbUser.id) {
        if (sub.schoolId) {
          const ok = await isSchoolMember(dbUser.id, sub.schoolId);
          if (!ok) throw AppError.forbidden("You cannot access this payment");
        } else {
          throw AppError.forbidden("You cannot access this payment");
        }
      }
    }
    return { success: true, data: payment };
  } catch (err) {
    return handleErr(err, "getPaymentAction");
  }
}

/* ── Invoices ───────────────────────────────────────────── */

export async function listInvoicesAction(
  filters: ListInvoicesQuery,
): Promise<ApiResponse<{ items: Invoice[]; total: number; page: number; pageSize: number }>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const parsed = listInvoicesQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const data = parsed.data;

    // Non-admins must scope invoices to their school (if they're a school admin).
    if (dbUser.role !== "platform_admin") {
      if (!data.schoolId) {
        throw AppError.validation("schoolId is required");
      }
      const ok = await isSchoolMember(dbUser.id, data.schoolId);
      if (!ok) {
        throw AppError.forbidden("You are not a member of this school");
      }
    }
    const result = await paymentsService.listInvoices(data);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listInvoicesAction");
  }
}

export async function getInvoiceAction(
  input: GetInvoiceInput,
): Promise<ApiResponse<InvoiceWithRelations>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const parsed = getInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const invoice = await paymentsService.getInvoice(parsed.data.id);
    if (dbUser.role !== "platform_admin") {
      if (!invoice.schoolId) {
        throw AppError.forbidden("You cannot access this invoice");
      }
      const ok = await isSchoolMember(dbUser.id, invoice.schoolId);
      if (!ok) throw AppError.forbidden("You are not a member of this school");
    }
    return { success: true, data: invoice };
  } catch (err) {
    return handleErr(err, "getInvoiceAction");
  }
}

/* ── Admin ──────────────────────────────────────────────── */

export async function listSubscriptionsAction(
  filters: ListSubscriptionsQuery,
): Promise<ApiResponse<{ items: Subscription[]; total: number; page: number; pageSize: number }>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "platform_admin", "support");
    const parsed = listSubscriptionsQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await paymentsService.listSubscriptions(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listSubscriptionsAction");
  }
}

/* ── Entitlements ───────────────────────────────────────── */

export async function getEntitlementsAction(
  userId?: string,
): Promise<ApiResponse<EntitlementResult>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const targetId = userId ?? dbUser.id;
    if (targetId !== dbUser.id && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You cannot view another user's entitlements");
    }
    const result = await entitlementsService.getUserEntitlements(targetId);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "getEntitlementsAction");
  }
}

export async function canAccessFeatureAction(
  input: CanAccessFeatureInput,
): Promise<ApiResponse<boolean>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const parsed = canAccessFeatureSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const targetId = parsed.data.userId ?? dbUser.id;
    if (targetId !== dbUser.id && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You cannot check another user's entitlements");
    }
    const ok = await entitlementsService.canAccessFeature(targetId, parsed.data.feature);
    return { success: true, data: ok };
  } catch (err) {
    return handleErr(err, "canAccessFeatureAction");
  }
}

export async function getPlanFeaturesAction(
  planType?: PlanType,
): Promise<ApiResponse<PlanDefinition | PlanDefinition[]>> {
  try {
    await requireSession();
    if (planType) {
      const plan = entitlementsService.getPlanFeatures(planType);
      return { success: true, data: plan };
    }
    const plans = entitlementsService.getAllPlans();
    return { success: true, data: plans };
  } catch (err) {
    return handleErr(err, "getPlanFeaturesAction");
  }
}

export async function checkSubscriptionStatusAction(): Promise<
  ApiResponse<{
    status: "free" | "active" | "past_due" | "expired" | "cancelled";
    inGracePeriod: boolean;
    planType: PlanType;
  }>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    const result = await entitlementsService.checkSubscriptionStatus(dbUser.id);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "checkSubscriptionStatusAction");
  }
}
