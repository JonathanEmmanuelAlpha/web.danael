/**
 * §5.16 — Admin service: user, school, content, subscription, payment
 * management + platform overview.
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 */

import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  users,
  schools,
  schoolMembers,
  contents,
  subscriptions,
  payments,
  subjects,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type { User } from "@/server/db/schema/users";
import type { School } from "@/server/db/schema/schools";
import type { Content } from "@/server/db/schema/contents";
import type { Subscription, Payment } from "@/server/db/schema/payments";
import type {
  ListUsersQuery,
  ListAdminSchoolsQuery,
  ListContentsAdminQuery,
  ListAdminSubscriptionsQuery,
  ListAdminPaymentsQuery,
} from "@/server/validators/admin";

/* -- Types --------------------------------------------------- */

export type { User, School, Content, Subscription, Payment };

export type AdminUserRow = Pick<
  User,
  | "id"
  | "email"
  | "firstName"
  | "lastName"
  | "avatarUrl"
  | "role"
  | "level"
  | "series"
  | "onboardingStatus"
  | "currentStreak"
  | "lastActiveAt"
  | "createdAt"
>;

export type AdminUserDetail = AdminUserRow & {
  schools: Array<{
    schoolId: string;
    schoolName: string;
    roleInSchool: string;
    status: string;
  }>;
  subscription: Pick<
    Subscription,
    "id" | "planType" | "status" | "endsAt" | "autoRenew"
  > | null;
};

export type AdminSchoolRow = School & {
  membersCount: number;
};

export type AdminContentRow = Pick<
  Content,
  | "id"
  | "title"
  | "type"
  | "visibility"
  | "publicationStatus"
  | "level"
  | "series"
  | "viewsCount"
  | "downloadsCount"
  | "createdAt"
  | "uploadedBy"
> & {
  uploader: Pick<User, "email" | "firstName" | "lastName"> | null;
  subject: Pick<typeof subjects.$inferSelect, "name"> | null;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type PlatformStats = {
  totalUsers: number;
  totalSchools: number;
  totalContents: number;
  activeSubscriptions: number;
  totalRevenue: number;
  pendingReports: number;
};

/* -- Users --------------------------------------------------- */

export async function listUsers(
  filters: ListUsersQuery,
): Promise<Paginated<AdminUserRow>> {
  const db = await getDb();
  const { page, pageSize, role, search } = filters;

  const conditions: SQL[] = [];
  if (role) conditions.push(eq(users.role, role));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(users.email, pattern),
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        level: users.level,
        series: users.series,
        onboardingStatus: users.onboardingStatus,
        currentStreak: users.currentStreak,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ c: count() }).from(users).where(where),
  ]);

  return {
    items: rows,
    total: Number(totalRows.at(0)?.c ?? 0),
    page,
    pageSize,
  };
}

export async function getUserById(id: string): Promise<AdminUserDetail> {
  const db = await getDb();
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      level: users.level,
      series: users.series,
      onboardingStatus: users.onboardingStatus,
      currentStreak: users.currentStreak,
      lastActiveAt: users.lastActiveAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const user = userRows.at(0);
  if (!user) throw AppError.notFound("User not found");

  const memberRows = await db
    .select({
      schoolId: schoolMembers.schoolId,
      schoolName: schools.name,
      roleInSchool: schoolMembers.roleInSchool,
      status: schoolMembers.status,
    })
    .from(schoolMembers)
    .innerJoin(schools, eq(schools.id, schoolMembers.schoolId))
    .where(eq(schoolMembers.userId, id));

  const subRows = await db
    .select({
      id: subscriptions.id,
      planType: subscriptions.planType,
      status: subscriptions.status,
      endsAt: subscriptions.endsAt,
      autoRenew: subscriptions.autoRenew,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return {
    ...user,
    schools: memberRows,
    subscription: subRows.at(0) ?? null,
  };
}

export async function updateUserRole(
  userId: string,
  role: User["role"],
): Promise<User> {
  const db = await getDb();
  const [updated] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) throw AppError.notFound("User not found");
  return updated;
}

/**
 * Soft-deactivate a user by downgrading them to the `support` role (least
 * privileged non-student role) — a soft, reversible deactivation.
 */
export async function deactivateUser(userId: string): Promise<User> {
  const db = await getDb();
  const [updated] = await db
    .update(users)
    .set({ role: "support", updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) throw AppError.notFound("User not found");
  return updated;
}

/* -- Schools -------------------------------------------------- */

export async function listSchools(
  filters: ListAdminSchoolsQuery,
): Promise<Paginated<AdminSchoolRow>> {
  const db = await getDb();
  const { page, pageSize, isVerified, search } = filters;

  const conditions: SQL[] = [];
  if (typeof isVerified === "boolean") {
    conditions.push(eq(schools.isVerified, isVerified));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(schools.name, pattern),
        ilike(schools.city, pattern),
        ilike(schools.slug, pattern),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: schools.id,
        clerkOrgId: schools.clerkOrgId,
        name: schools.name,
        slug: schools.slug,
        type: schools.type,
        city: schools.city,
        region: schools.region,
        logoUrl: schools.logoUrl,
        isVerified: schools.isVerified,
        contactEmail: schools.contactEmail,
        contactPhone: schools.contactPhone,
        createdAt: schools.createdAt,
        updatedAt: schools.updatedAt,
        membersCount: count(schoolMembers.id),
        joinCode: schools.joinCode,
      })
      .from(schools)
      .leftJoin(schoolMembers, eq(schoolMembers.schoolId, schools.id))
      .where(where)
      .groupBy(schools.id)
      .orderBy(desc(schools.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ c: count() }).from(schools).where(where),
  ]);

  return {
    items: rows.map((r) => ({ ...r, membersCount: Number(r.membersCount) })),
    total: Number(totalRows.at(0)?.c ?? 0),
    page,
    pageSize,
  };
}

export async function verifySchool(
  schoolId: string,
  verified: boolean,
): Promise<School> {
  const db = await getDb();
  const [updated] = await db
    .update(schools)
    .set({ isVerified: verified, updatedAt: new Date() })
    .where(eq(schools.id, schoolId))
    .returning();
  if (!updated) throw AppError.notFound("School not found");
  return updated;
}

/* -- Contents ------------------------------------------------ */

export async function listContents(
  filters: ListContentsAdminQuery,
): Promise<Paginated<AdminContentRow>> {
  const db = await getDb();
  const { page, pageSize, visibility, publicationStatus, search } = filters;

  const conditions: SQL[] = [];
  if (visibility) conditions.push(eq(contents.visibility, visibility));
  if (publicationStatus) {
    conditions.push(eq(contents.publicationStatus, publicationStatus));
  }
  if (search) {
    conditions.push(ilike(contents.title, `%${search}%`)!);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: contents.id,
        title: contents.title,
        type: contents.type,
        visibility: contents.visibility,
        publicationStatus: contents.publicationStatus,
        level: contents.level,
        series: contents.series,
        viewsCount: contents.viewsCount,
        downloadsCount: contents.downloadsCount,
        createdAt: contents.createdAt,
        uploadedBy: contents.uploadedBy,
        uploader: {
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        subject: { name: subjects.name },
      })
      .from(contents)
      .leftJoin(users, eq(users.id, contents.uploadedBy))
      .leftJoin(subjects, eq(subjects.id, contents.subjectId))
      .where(where)
      .orderBy(desc(contents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ c: count() }).from(contents).where(where),
  ]);

  return {
    items: rows,
    total: Number(totalRows.at(0)?.c ?? 0),
    page,
    pageSize,
  };
}

/* -- Subscriptions / Payments -------------------------------- */

export async function listSubscriptions(
  filters: ListAdminSubscriptionsQuery,
): Promise<Paginated<Subscription>> {
  const db = await getDb();
  const { page, pageSize, status, userId, schoolId } = filters;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(subscriptions.status, status));
  if (userId) conditions.push(eq(subscriptions.userId, userId));
  if (schoolId) conditions.push(eq(subscriptions.schoolId, schoolId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(subscriptions)
      .where(where)
      .orderBy(desc(subscriptions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ c: count() }).from(subscriptions).where(where),
  ]);

  return {
    items: rows,
    total: Number(totalRows.at(0)?.c ?? 0),
    page,
    pageSize,
  };
}

export async function listPayments(
  filters: ListAdminPaymentsQuery,
): Promise<Paginated<Payment>> {
  const db = await getDb();
  const { page, pageSize, status, provider, subscriptionId } = filters;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(payments.status, status));
  if (provider) conditions.push(eq(payments.provider, provider));
  if (subscriptionId) {
    conditions.push(eq(payments.subscriptionId, subscriptionId));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ c: count() }).from(payments).where(where),
  ]);

  return {
    items: rows,
    total: Number(totalRows.at(0)?.c ?? 0),
    page,
    pageSize,
  };
}

/* -- Platform stats ------------------------------------------ */

export async function getPlatformStats(): Promise<PlatformStats> {
  const db = await getDb();
  const [userRow, schoolRow, contentRow, subRow] = await Promise.all([
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(schools),
    db.select({ c: count() }).from(contents),
    db
      .select({ c: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
  ]);

  // Total revenue = sum of all succeeded payment amounts (XOF stored as string).
  const paymentRows = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(eq(payments.status, "succeeded"));
  const totalRevenue = paymentRows.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  // Pending reports — lazy import to avoid circular deps with moderation service.
  const { getPendingReportsCount } =
    await import("@/server/services/moderation");
  const pendingReports = await getPendingReportsCount();

  return {
    totalUsers: Number(userRow.at(0)?.c ?? 0),
    totalSchools: Number(schoolRow.at(0)?.c ?? 0),
    totalContents: Number(contentRow.at(0)?.c ?? 0),
    activeSubscriptions: Number(subRow.at(0)?.c ?? 0),
    totalRevenue,
    pendingReports,
  };
}
