/**
 * §5.13 / §17 — Payments Zod validators.
 *
 * Used by server actions to validate all subscription / payment / invoice
 * inputs. Mirrors the DB schema enums (see src/server/db/schema/enums.ts).
 */

import { z } from "zod";
import {
  PAYMENT_PROVIDER_VALUES,
  PAYMENT_STATUS_VALUES,
  SUBSCRIPTION_STATUS_VALUES,
  INVOICE_STATUS_VALUES,
  PLAN_TYPE_VALUES,
} from "@/server/db/schema/enums";
import type { PlanType } from "@/server/providers/payments/types";

/* -- Subscriptions -------------------------------------------- */

export const planTypeSchema = z.enum(
  PLAN_TYPE_VALUES as unknown as [PlanType, ...PlanType[]],
);

export const createSubscriptionSchema = z
  .object({
    /** User owner (mutually exclusive with schoolId). */
    userId: z.uuid().optional(),
    /** School owner (institution license). */
    schoolId: z.uuid().optional(),
    planType: planTypeSchema,
    /** Amount in XOF (smallest currency unit, integer). */
    amount: z.number().int().min(0),
    currency: z.string().min(3).max(3).default("XOF"),
    /** Whether the subscription auto-renews at the end of the period. */
    autoRenew: z.boolean().default(false),
    /** Duration in days. Defaults derived from PLANS catalog when omitted. */
    billingPeriodDays: z.number().int().min(1).max(365).optional(),
  })
  .refine((d) => Boolean(d.userId) !== Boolean(d.schoolId), {
    message: "Provide either userId or schoolId (not both, not neither)",
    path: ["userId"],
  });

export const updateSubscriptionSchema = z.object({
  id: z.uuid(),
  planType: planTypeSchema.optional(),
  amount: z.number().int().min(0).optional(),
  currency: z.string().min(3).max(3).optional(),
  autoRenew: z.boolean().optional(),
  status: z.enum(SUBSCRIPTION_STATUS_VALUES).optional(),
  endsAt: z.iso.datetime().nullable().optional(),
});

export const cancelSubscriptionSchema = z.object({
  id: z.uuid(),
});

/* -- Payments ------------------------------------------------ */

export const initiatePaymentSchema = z.object({
  subscriptionId: z.uuid(),
  provider: z.enum(PAYMENT_PROVIDER_VALUES),
  amount: z.number().int().min(1),
  currency: z.string().min(3).max(3).default("XOF"),
  /** Required for Mobile Money flows (MTN, Orange). */
  payerMsisdn: z
    .string()
    .regex(/^\d{8,15}$/, "Phone must be 8-15 digits, no spaces")
    .optional(),
  description: z.string().max(200).optional(),
});

export const confirmPaymentSchema = z.object({
  paymentId: z.uuid(),
  /** Provider transaction reference returned by the gateway. */
  providerTransactionId: z.string().min(1).max(200),
});

export const listPaymentsQuerySchema = z.object({
  subscriptionId: z.uuid().optional(),
  userId: z.uuid().optional(),
  schoolId: z.uuid().optional(),
  status: z.enum(PAYMENT_STATUS_VALUES).optional(),
  provider: z.enum(PAYMENT_PROVIDER_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listSubscriptionsQuerySchema = z.object({
  status: z.enum(SUBSCRIPTION_STATUS_VALUES).optional(),
  planType: planTypeSchema.optional(),
  userId: z.uuid().optional(),
  schoolId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/* -- Invoices ----------------------------------------------- */

export const listInvoicesQuerySchema = z.object({
  schoolId: z.uuid().optional(),
  subscriptionId: z.uuid().optional(),
  status: z.enum(INVOICE_STATUS_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const getInvoiceSchema = z.object({
  id: z.uuid(),
});

/* -- Entitlements ------------------------------------------- */

export const canAccessFeatureSchema = z.object({
  feature: z.string().min(1).max(80),
  userId: z.uuid().optional(),
});

/* -- Types -------------------------------------------------- */

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type ListSubscriptionsQuery = z.infer<
  typeof listSubscriptionsQuerySchema
>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type GetInvoiceInput = z.infer<typeof getInvoiceSchema>;
export type CanAccessFeatureInput = z.infer<typeof canAccessFeatureSchema>;
