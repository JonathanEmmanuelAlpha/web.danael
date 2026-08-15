/**
 * §5.13 / §17.1 — Payment provider abstraction.
 *
 * Each provider implements the `PaymentProvider` interface. The factory in
 * `index.ts` returns the right implementation based on a `provider` param.
 *
 * Critical rules (§17.2):
 *  - Never activate an access on simple client return — always verify via
 *    webhook or explicit provider status check.
 *  - All providers must degrade gracefully when their env vars are missing
 *    (return a clear PROVIDER_ERROR rather than crashing).
 */

import type { PaymentProviderValue } from "@/server/db/schema/enums";

/* -- Inputs / Outputs ---------------------------------------- */

export interface InitiatePaymentInput {
  /** Internal payment row id (we pass it as external reference). */
  paymentId: string;
  /** Subscription id linked to the payment (for metadata). */
  subscriptionId: string;
  /** Amount in the smallest currency unit (XOF has 0 decimals). */
  amount: number;
  /** ISO 4217 currency code (default XOF). */
  currency: string;
  /** Human-readable description shown to the payer. */
  description?: string;
  /** Payer MSISDN for Mobile Money flows (E.164, e.g. "2376XXXXXXXX"). */
  payerMsisdn?: string;
  /** Front-end URL the provider should redirect to after the popup. */
  returnUrl?: string;
  /** Webhook URL the provider should call (must be exposed via gateway). */
  webhookUrl?: string;
}

export interface InitiatePaymentOutput {
  /** Provider transaction reference to poll / verify later. */
  providerTransactionId: string;
  /** Status right after initiation (typically "pending"). */
  status: "pending";
  /** Optional URL the front-end should redirect to (card / web flow). */
  redirectUrl?: string;
  /** Optional raw payload from the provider (for debugging). */
  raw?: unknown;
}

export interface PaymentStatusOutput {
  status: "pending" | "succeeded" | "failed" | "refunded";
  /** Provider transaction id (echoed back). */
  providerTransactionId: string;
  /** Optional reason for failure / dispute. */
  reason?: string;
  /** Optional raw payload from the provider. */
  raw?: unknown;
}

export interface WebhookVerification {
  /** Whether the webhook signature is valid. */
  valid: boolean;
  /** Provider name (mtn_money / orange_money / stripe). */
  provider: PaymentProviderValue;
  /** Transaction id extracted from the webhook body. */
  providerTransactionId: string;
  /** New status conveyed by the webhook. */
  status: "pending" | "succeeded" | "failed" | "refunded";
  /** Optional amount + currency conveyed by the webhook (cross-check). */
  amount?: number;
  currency?: string;
  /** Raw parsed body for audit logging. */
  raw?: unknown;
}

/* -- Provider interface ------------------------------------- */

export interface PaymentProvider {
  /** Stable provider identifier (matches `PaymentProviderValue`). */
  readonly name: PaymentProviderValue;
  /** Human-readable label (i18n keys live in messages). */
  readonly label: string;
  /** Whether the provider is configured (env vars present). */
  readonly configured: boolean;

  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput>;

  checkStatus(transactionId: string): Promise<PaymentStatusOutput>;

  /** Verify the incoming webhook Request — signature + parse body. */
  verifyWebhook(req: Request): Promise<WebhookVerification>;
}

/* -- Plan / entitlement feature catalog -------------------- */

export type PlanType = "free" | "essential" | "premium" | "institution";

export interface PlanFeature {
  key: string;
  /** When true, the feature is included in this plan; when false, excluded. */
  included: boolean;
  /** Optional limit (e.g. "5 quizzes per week") — null = unlimited. */
  limit?: number | null;
}

export interface PlanDefinition {
  type: PlanType;
  /** Price per billing period, in XOF (0 for free). */
  price: number;
  currency: string;
  /** Billing period in days (30 = monthly, 365 = yearly). */
  billingPeriodDays: number;
  /** Human-readable name i18n key under "Billing.plans". */
  nameKey: string;
  /** Short tagline i18n key under "Billing.plans". */
  taglineKey: string;
  features: PlanFeature[];
  /** True if the plan is for institutions (school license). */
  institutional: boolean;
}

/**
 * Canonical plan catalog. The "free" plan is always available.
 *
 * NOTE: these prices are example values in XOF (CFA francs). They can be
 * overridden per-environment by changing this single source of truth.
 */
export const PLANS: Record<PlanType, PlanDefinition> = {
  free: {
    type: "free",
    price: 0,
    currency: "XOF",
    billingPeriodDays: 0,
    nameKey: "Billing.plans.free.name",
    taglineKey: "Billing.plans.free.tagline",
    institutional: false,
    features: [
      { key: "libraryAccess", included: true, limit: 50 },
      { key: "quizzesPerWeek", included: true, limit: 5 },
      { key: "assignmentsSubmit", included: true, limit: 10 },
      { key: "advancedQuizzes", included: false },
      { key: "tutorBooking", included: false },
      { key: "parentAccess", included: false },
      { key: "analyticsExport", included: false },
      { key: "prioritySupport", included: false },
      { key: "customBranding", included: false },
      { key: "unlimitedContents", included: false },
    ],
  },
  essential: {
    type: "essential",
    price: 2500,
    currency: "XOF",
    billingPeriodDays: 30,
    nameKey: "Billing.plans.essential.name",
    taglineKey: "Billing.plans.essential.tagline",
    institutional: false,
    features: [
      { key: "libraryAccess", included: true, limit: null },
      { key: "quizzesPerWeek", included: true, limit: null },
      { key: "assignmentsSubmit", included: true, limit: null },
      { key: "advancedQuizzes", included: true },
      { key: "tutorBooking", included: true },
      { key: "parentAccess", included: false },
      { key: "analyticsExport", included: false },
      { key: "prioritySupport", included: false },
      { key: "customBranding", included: false },
      { key: "unlimitedContents", included: true },
    ],
  },
  premium: {
    type: "premium",
    price: 6000,
    currency: "XOF",
    billingPeriodDays: 30,
    nameKey: "Billing.plans.premium.name",
    taglineKey: "Billing.plans.premium.tagline",
    institutional: false,
    features: [
      { key: "libraryAccess", included: true, limit: null },
      { key: "quizzesPerWeek", included: true, limit: null },
      { key: "assignmentsSubmit", included: true, limit: null },
      { key: "advancedQuizzes", included: true },
      { key: "tutorBooking", included: true },
      { key: "parentAccess", included: true },
      { key: "analyticsExport", included: true },
      { key: "prioritySupport", included: true },
      { key: "customBranding", included: false },
      { key: "unlimitedContents", included: true },
    ],
  },
  institution: {
    type: "institution",
    price: 50000,
    currency: "XOF",
    billingPeriodDays: 30,
    nameKey: "Billing.plans.institution.name",
    taglineKey: "Billing.plans.institution.tagline",
    institutional: true,
    features: [
      { key: "libraryAccess", included: true, limit: null },
      { key: "quizzesPerWeek", included: true, limit: null },
      { key: "assignmentsSubmit", included: true, limit: null },
      { key: "advancedQuizzes", included: true },
      { key: "tutorBooking", included: true },
      { key: "parentAccess", included: true },
      { key: "analyticsExport", included: true },
      { key: "prioritySupport", included: true },
      { key: "customBranding", included: true },
      { key: "unlimitedContents", included: true },
    ],
  },
};

export const PLAN_TYPES: PlanType[] = [
  "free",
  "essential",
  "premium",
  "institution",
];

/** Grace period (days) after expiry during which access is still allowed. */
export const GRACE_PERIOD_DAYS = 7;
