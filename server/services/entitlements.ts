/**
 * §5.13 — Entitlements service.
 *
 * Determines access rights based on:
 *  - role (every role has a baseline set of permissions)
 *  - individual subscription (student / family plan)
 *  - school license (institution plan, granted via school membership)
 *  - family plan (parent subscription extends to children)
 *
 * The source of truth is ALWAYS the database. Client-side entitlement checks
 * are forbidden — the server must re-check on every privileged operation.
 */

import { and, eq, gte, isNotNull, or } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  subscriptions,
  schoolMembers,
  parentStudentRelations,
  payments,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";

import { PLANS, GRACE_PERIOD_DAYS } from "@/server/providers/payments/types";
import type {
  PlanType,
  PlanFeature,
  PlanDefinition,
} from "@/server/providers/payments/types";
import { logger } from "@/lib/logger";

export interface EntitlementResult {
  /** Whether the user has access to the platform (active sub or free plan). */
  hasAccess: boolean;
  /** Best plan available to the user. */
  planType: PlanType;
  /** Subscription status (active / expired / cancelled / past_due / free). */
  subscriptionStatus: "free" | "active" | "past_due" | "expired" | "cancelled";
  /** Whether the subscription is in grace period (expired but < GRACE_PERIOD_DAYS). */
  inGracePeriod: boolean;
  /** Map of feature key → feature. */
  features: Record<string, PlanFeature>;
  /** Optional id of the subscription in effect. */
  subscriptionId?: string;
  /** Optional id of the school license in effect (institution). */
  schoolSubscriptionId?: string;
}

/* -- Plan catalog accessors -------------------------------- */

export function getPlanFeatures(planType: PlanType): PlanDefinition {
  const plan = PLANS[planType];
  if (!plan) throw AppError.validation(`Unknown plan: ${planType}`);
  return plan;
}

export function getAllPlans(): PlanDefinition[] {
  return Object.values(PLANS);
}

/* -- Subscription lookup helpers ---------------------------- */

async function getActiveSubscriptionForUser(
  userId: string,
  now: Date = new Date(),
): Promise<{
  sub: typeof subscriptions.$inferSelect | null;
  inGrace: boolean;
}> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(subscriptions.createdAt)
    .limit(1);
  const sub = rows.at(0) ?? null;
  if (!sub) return { sub: null, inGrace: false };

  // Determine if active, in grace, or expired.
  if (sub.status === "cancelled" || sub.status === "free") {
    return { sub, inGrace: false };
  }
  if (!sub.endsAt) return { sub, inGrace: false };

  if (sub.endsAt > now) {
    return { sub, inGrace: false };
  }
  // Past endsAt → check grace.
  const graceEnd = new Date(sub.endsAt);
  graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
  return { sub, inGrace: graceEnd > now };
}

async function getActiveSchoolSubscription(
  userId: string,
  now: Date = new Date(),
): Promise<{ sub: typeof subscriptions.$inferSelect | null }> {
  const db = await getDb();
  // Find all schools where the user is an active member.
  const memberships = await db
    .select({ schoolId: schoolMembers.schoolId })
    .from(schoolMembers)
    .where(
      and(eq(schoolMembers.userId, userId), eq(schoolMembers.status, "active")),
    );
  if (memberships.length === 0) return { sub: null };

  for (const m of memberships) {
    const rows = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.schoolId, m.schoolId),
          eq(subscriptions.planType, "institution"),
        ),
      )
      .limit(1);
    const sub = rows.at(0);
    if (!sub) continue;
    if (sub.status !== "active") continue;
    if (!sub.endsAt || sub.endsAt > now) return { sub };
    // In grace?
    const graceEnd = new Date(sub.endsAt);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
    if (graceEnd > now) return { sub };
  }
  return { sub: null };
}

async function getActiveFamilySubscription(
  userId: string,
  now: Date = new Date(),
): Promise<{ sub: typeof subscriptions.$inferSelect | null }> {
  // For parents: their own "premium" subscription grants access to children.
  // For students: check if any parent linked to them has a premium subscription.
  const db = await getDb();
  const mySubs = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.planType, "premium"),
      ),
    )
    .limit(1);
  const mySub = mySubs.at(0);
  if (
    mySub &&
    mySub.status === "active" &&
    (!mySub.endsAt || mySub.endsAt > now)
  ) {
    return { sub: mySub };
  }

  // Look at parents of this user (if user is a student).
  const parents = await db
    .select({ parentId: parentStudentRelations.parentId })
    .from(parentStudentRelations)
    .where(eq(parentStudentRelations.studentId, userId));
  for (const p of parents) {
    const rows = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, p.parentId),
          eq(subscriptions.planType, "premium"),
        ),
      )
      .limit(1);
    const sub = rows.at(0);
    if (sub && sub.status === "active" && (!sub.endsAt || sub.endsAt > now)) {
      return { sub };
    }
  }
  return { sub: null };
}

/* -- Main API ---------------------------------------------- */

export async function getUserEntitlements(
  userId: string,
  now: Date = new Date(),
): Promise<EntitlementResult> {
  const [individual, school, family] = await Promise.all([
    getActiveSubscriptionForUser(userId, now),
    getActiveSchoolSubscription(userId, now),
    getActiveFamilySubscription(userId, now),
  ]);

  // Build effective plan by merging: institution > premium > essential > free.
  const candidates: Array<{
    planType: PlanType;
    sub?: typeof subscriptions.$inferSelect | null;
    inGrace: boolean;
    source: "individual" | "school" | "family";
  }> = [];

  if (individual.sub) {
    candidates.push({
      planType: individual.sub.planType as PlanType,
      sub: individual.sub,
      inGrace: individual.inGrace,
      source: "individual",
    });
  }
  if (school.sub) {
    candidates.push({
      planType: school.sub.planType as PlanType,
      sub: school.sub,
      inGrace: false,
      source: "school",
    });
  }
  if (family.sub) {
    candidates.push({
      planType: family.sub.planType as PlanType,
      sub: family.sub,
      inGrace: false,
      source: "family",
    });
  }

  const priority: Record<PlanType, number> = {
    institution: 4,
    premium: 3,
    essential: 2,
    free: 1,
  };

  let bestPlan: PlanType = "free";
  let bestSub: typeof subscriptions.$inferSelect | null = null;
  let bestInGrace = false;
  let bestSource: EntitlementResult["subscriptionStatus"] = "free";

  for (const c of candidates) {
    if (priority[c.planType] > priority[bestPlan]) {
      bestPlan = c.planType;
      bestSub = c.sub!;
      bestInGrace = c.inGrace;
      bestSource = c.sub?.status ?? "free";
    }
  }

  const features: Record<string, PlanFeature> = {};
  for (const f of PLANS[bestPlan].features) {
    features[f.key] = f;
  }

  return {
    hasAccess:
      bestPlan === "free"
        ? true
        : Boolean(bestSub) && (bestSub?.status === "active" || bestInGrace),
    planType: bestPlan,
    subscriptionStatus: bestSource,
    inGracePeriod: bestInGrace,
    features,
    subscriptionId: bestSub?.id,
    schoolSubscriptionId:
      bestSource === "active" && school.sub ? school.sub.id : undefined,
  };
}

export async function canAccessFeature(
  userId: string,
  feature: string,
  now: Date = new Date(),
): Promise<boolean> {
  const entitlements = await getUserEntitlements(userId, now);
  const feat = entitlements.features[feature];
  if (!feat) {
    // Unknown feature → deny by default + log.
    logger.warn("canAccessFeature: unknown feature", { feature, userId });
    return false;
  }
  // If a feature is included AND user has access (active sub or in grace or free plan).
  if (!feat.included) return false;
  return entitlements.hasAccess || entitlements.planType === "free";
}

export async function checkSubscriptionStatus(
  userId: string,
  now: Date = new Date(),
): Promise<{
  status: "free" | "active" | "past_due" | "expired" | "cancelled";
  inGracePeriod: boolean;
  planType: PlanType;
}> {
  const e = await getUserEntitlements(userId, now);
  return {
    status: e.subscriptionStatus,
    inGracePeriod: e.inGracePeriod,
    planType: e.planType,
  };
}

/**
 * Aggregate stats for the platform-admin dashboard: total subscriptions
 * (active + past_due), and total payments (succeeded).
 */
export async function getPlatformSubscriptionStats(): Promise<{
  activeSubscriptions: number;
  totalPaymentsSucceeded: number;
  totalRevenue: number;
}> {
  const db = await getDb();
  const activeRow = await db
    .select({ c: subscriptions.id })
    .from(subscriptions)
    .where(
      or(
        eq(subscriptions.status, "active"),
        eq(subscriptions.status, "past_due"),
      ),
    );
  const paymentRows = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(eq(payments.status, "succeeded"));
  const totalRevenue = paymentRows.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  return {
    activeSubscriptions: activeRow.length,
    totalPaymentsSucceeded: paymentRows.length,
    totalRevenue,
  };
}

void isNotNull;
void gte;
