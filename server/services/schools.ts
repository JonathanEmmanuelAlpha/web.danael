/**
 * §5.3 — School service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 */

import { and, count, desc, eq, ilike, or, SQL, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  classes,
  classMembers,
  schools,
  schoolMembers,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import { slugify } from "@/lib/slug";
import { generateJoinCode } from "@/server/services/memberships";
import type {
  CreateSchoolInput,
  UpdateSchoolInput,
  ListSchoolsQuery,
} from "@/server/validators/schools";
import type { School, SchoolMember } from "@/server/db/schema/schools";
import type { User } from "@/server/db/schema/users";

/* -- Types --------------------------------------------------- */

export type { School, SchoolMember };

export type SchoolWithCounts = School & {
  membersCount: number;
  classesCount: number;
  teachersCount: number;
  studentsCount: number;
};

/**
 * Public-facing card view for a school (used on /schools listing).
 *
 * `joinCode` is only populated when the requester is the school's admin owner.
 * `contactUserId` is the user id of the first active admin (used to start a
 * direct conversation from the "Message us" button); null if no admin exists.
 */
export interface SchoolCardData {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  city: string | null;
  region: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  membersCount: number;
  classesCount: number;
  teachersCount: number;
  studentsCount: number;
  joinCode: string | null;
  contactUserId: string | null;
}

/**
 * Public-facing card view for a class (used on school detail page).
 */
export interface ClassCardData {
  id: string;
  name: string;
  level: string | null;
  series: string | null;
  academicYear: string | null;
  membersCount: number;
  studentsCount: number;
  teachersCount: number;
  schoolName: string;
}

export type SchoolMemberWithUser = SchoolMember & {
  user: Pick<
    User,
    "id" | "email" | "firstName" | "lastName" | "avatarUrl" | "role"
  >;
};

/**
 * Shape of the email-based invite input (resolved into a user internally).
 */
export type InviteByEmailInput = {
  schoolId: string;
  email: string;
  roleInSchool: "admin" | "teacher" | "student" | "parent" | "staff";
};

/* -- Slug helper --------------------------------------------- */

async function ensureUniqueSlug(base: string): Promise<string> {
  const db = await getDb();
  let slug = base;
  let suffix = 1;
  // Loop until we find a slug that's not taken.
  for (;;) {
    const existing = await db
      .select({ id: schools.id })
      .from(schools)
      .where(eq(schools.slug, slug))
      .limit(1);
    if (existing.length === 0) return slug;
    slug = `${base}-${suffix++}`;
    if (suffix > 99) return `${base}-${crypto.randomUUID().slice(0, 6)}`;
  }
}

/* -- Mutations ----------------------------------------------- */

/**
 * Create a new school and immediately add the creator as `school_admin`.
 * `slug` is auto-derived from the name if not provided.
 */
export async function createSchool(
  input: CreateSchoolInput,
  creatorUserId: string,
): Promise<School> {
  const db = await getDb();

  const slug = input.slug ?? (await ensureUniqueSlug(slugify(input.name)));

  // Check slug uniqueness one more time inside the function.
  const existing = await db
    .select({ id: schools.id })
    .from(schools)
    .where(eq(schools.slug, slug))
    .limit(1);
  if (existing.length > 0) {
    throw AppError.conflict("Slug already in use", { slug });
  }

  const [created] = await db
    .insert(schools)
    .values({
      clerkOrgId: input.clerkOrgId,
      name: input.name,
      slug,
      type: input.type,
      city: input.city,
      region: input.region,
      logoUrl: input.logoUrl,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      // Generate a unique join code so students/teachers can join by code
      joinCode: generateJoinCode(),
    })
    .returning();
  if (!created) {
    throw AppError.internal("Failed to create school");
  }

  // Add the creator as the first admin member.
  await db.insert(schoolMembers).values({
    schoolId: created.id,
    userId: creatorUserId,
    roleInSchool: "admin",
    status: "active",
    invitedBy: creatorUserId,
    joinedAt: new Date(),
  });

  return created;
}

/**
 * Update editable school fields.
 */
export async function updateSchool(
  id: string,
  input: UpdateSchoolInput,
): Promise<School> {
  const db = await getDb();
  const [updated] = await db
    .update(schools)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.contactEmail !== undefined
        ? { contactEmail: input.contactEmail }
        : {}),
      ...(input.contactPhone !== undefined
        ? { contactPhone: input.contactPhone }
        : {}),
      ...(input.isVerified !== undefined
        ? { isVerified: input.isVerified }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schools.id, id))
    .returning();
  if (!updated) throw AppError.notFound("School not found");
  return updated;
}

/**
 * Set isVerified = true. Used by platform admins (or auto-verify for now).
 */
export async function verifySchool(id: string): Promise<School> {
  const db = await getDb();
  const [updated] = await db
    .update(schools)
    .set({ isVerified: true, updatedAt: new Date() })
    .where(eq(schools.id, id))
    .returning();
  if (!updated) throw AppError.notFound("School not found");
  return updated;
}

/* -- Queries ------------------------------------------------- */

export async function getSchoolById(id: string): Promise<SchoolWithCounts> {
  const db = await getDb();
  const rows = await db
    .select({
      school: schools,
      membersCount: count(schoolMembers.id),
    })
    .from(schools)
    .leftJoin(schoolMembers, eq(schoolMembers.schoolId, schools.id))
    .where(eq(schools.id, id))
    .groupBy(schools.id)
    .limit(1);

  const row = rows.at(0);
  if (!row) throw AppError.notFound("School not found");

  const classesCountRow = await db
    .select({ c: count(classes.id) })
    .from(classes)
    .where(eq(classes.schoolId, id));

  return {
    ...row.school,
    membersCount: Number(row.membersCount ?? 0),
    classesCount: Number(classesCountRow.at(0)?.c ?? 0),
    teachersCount: await countMembersByRole(id, "teacher"),
    studentsCount: await countMembersByRole(id, "student"),
  };
}

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schools)
    .where(eq(schools.slug, slug))
    .limit(1);
  return rows.at(0) ?? null;
}

/**
 * Get the first school where the user is an admin (helper for school_admin pages).
 */
export async function getSchoolForAdminUser(
  userId: string,
): Promise<School | null> {
  const db = await getDb();
  const rows = await db
    .select({ school: schools })
    .from(schoolMembers)
    .innerJoin(schools, eq(schools.id, schoolMembers.schoolId))
    .where(
      and(
        eq(schoolMembers.userId, userId),
        eq(schoolMembers.roleInSchool, "admin"),
        eq(schoolMembers.status, "active"),
      ),
    )
    .limit(1);
  return rows.at(0)?.school ?? null;
}

export async function listSchools(
  filters: ListSchoolsQuery,
): Promise<{ items: School[]; total: number; page: number; pageSize: number }> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (filters.search) {
    const needle = `%${filters.search}%`;
    conditions.push(
      or(ilike(schools.name, needle), ilike(schools.city, needle)) as never,
    );
  }
  if (filters.type) conditions.push(eq(schools.type, filters.type) as never);
  if (filters.city)
    conditions.push(ilike(schools.city, `%${filters.city}%`) as never);
  if (filters.isVerified !== undefined)
    conditions.push(eq(schools.isVerified, filters.isVerified) as never);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (filters.page - 1) * filters.pageSize;

  const items = await db
    .select()
    .from(schools)
    .where(where)
    .orderBy(schools.createdAt)
    .limit(filters.pageSize)
    .offset(offset);

  const totalRow = await db.select({ c: count() }).from(schools).where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

async function countMembersByRole(
  schoolId: string,
  role: "admin" | "teacher" | "student" | "parent" | "staff",
): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.roleInSchool, role),
        eq(schoolMembers.status, "active"),
      ),
    );
  return Number(rows.at(0)?.c ?? 0);
}

/* -- Membership ---------------------------------------------- */

/**
 * Invite a user by email. If the email matches a known user, the membership
 * is created immediately; otherwise we surface a friendly error message.
 *
 * Returns the created/updated `school_members` row (status = "pending").
 */
export async function inviteMemberByEmail(
  input: InviteByEmailInput,
  invitedBy: string,
): Promise<SchoolMember> {
  const db = await getDb();

  // Look up the user by email.
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  const user = userRows.at(0);

  if (!user) {
    throw AppError.notFound(
      "No user found with that email. Ask them to create a Danaël account first.",
    );
  }

  // Idempotent: if a membership already exists for this user/school, update it.
  const existingRows = await db
    .select()
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, input.schoolId),
        eq(schoolMembers.userId, user.id),
      ),
    )
    .limit(1);
  const existing = existingRows.at(0);
  if (existing) {
    const [updated] = await db
      .update(schoolMembers)
      .set({
        roleInSchool: input.roleInSchool,
        status: "pending",
        invitedBy,
      })
      .where(eq(schoolMembers.id, existing.id))
      .returning();
    if (!updated) throw AppError.internal("Failed to update membership");
    return updated;
  }

  const [created] = await db
    .insert(schoolMembers)
    .values({
      schoolId: input.schoolId,
      userId: user.id,
      roleInSchool: input.roleInSchool,
      status: "pending",
      invitedBy,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to invite member");
  return created;
}

/**
 * Directly add a user (by id) as a member — used for the creator / invites
 * that have already been accepted elsewhere.
 */
export async function addMember(
  schoolId: string,
  userId: string,
  roleInSchool: "admin" | "teacher" | "student" | "parent" | "staff",
  invitedBy?: string,
): Promise<SchoolMember> {
  const db = await getDb();
  const [created] = await db
    .insert(schoolMembers)
    .values({
      schoolId,
      userId,
      roleInSchool,
      status: "active",
      invitedBy,
      joinedAt: new Date(),
    })
    .returning();
  if (!created) throw AppError.internal("Failed to add member");
  return created;
}

export async function listMembers(
  schoolId: string,
  filterRole: "student" | "teacher" | "parent" | "admin" | "staff" = "teacher",
): Promise<SchoolMemberWithUser[]> {
  const db = await getDb();
  const rows = await db
    .select({
      member: schoolMembers,
      user: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        role: users.role,
      },
    })
    .from(schoolMembers)
    .innerJoin(users, eq(users.id, schoolMembers.userId))
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.roleInSchool, filterRole),
      ),
    )
    .orderBy(schoolMembers.createdAt);
  return rows.map((r) => ({ ...r.member, user: r.user }));
}

export async function removeMember(
  schoolId: string,
  userId: string,
): Promise<void> {
  const db = await getDb();
  await db
    .delete(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId),
      ),
    );
}

export async function updateMemberRole(
  schoolId: string,
  userId: string,
  roleInSchool: "admin" | "teacher" | "student" | "parent" | "staff",
): Promise<SchoolMember> {
  const db = await getDb();
  const [updated] = await db
    .update(schoolMembers)
    .set({ roleInSchool })
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId),
      ),
    )
    .returning();
  if (!updated) throw AppError.notFound("Member not found");
  return updated;
}

export async function getMember(
  schoolId: string,
  userId: string,
): Promise<SchoolMember | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId),
      ),
    )
    .limit(1);
  return rows.at(0) ?? null;
}

/**
 * Re-export count helper for reuse in dashboard stats.
 */
export async function countClassMembersByRole(
  classId: string,
  role: "admin" | "teacher" | "student" | "parent" | "staff",
): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(classMembers)
    .where(and(eq(classMembers.classId, classId), eq(classMembers.role, role)));
  return Number(rows.at(0)?.c ?? 0);
}

// `sql` is used by `listSchoolsFTS` (PostgreSQL tsvector full-text search).

/* -- Public listing (FTS + card view) ------------------------- */

/**
 * Convert a raw schools row into the public `SchoolCardData` shape, enriched
 * with members/classes/teachers/students counts and the school's first
 * active admin user id (used as the contact for the "Message us" button).
 *
 * `joinCode` is only surfaced when `revealJoinCode` is true (i.e. the
 * requester is the school's admin owner — enforced by the server action).
 */
async function toSchoolCardData(
  school: School,
  revealJoinCode: boolean,
): Promise<SchoolCardData> {
  const [membersCount, classesCount, teachersCount, studentsCount, adminRow] =
    await Promise.all([
      countAllMembers(school.id),
      countClasses(school.id),
      countMembersByRole(school.id, "teacher"),
      countMembersByRole(school.id, "student"),
      findFirstAdminUserId(school.id),
    ]);

  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    type: school.type ?? null,
    city: school.city ?? null,
    region: school.region ?? null,
    logoUrl: school.logoUrl ?? null,
    isVerified: school.isVerified,
    contactEmail: school.contactEmail ?? null,
    contactPhone: school.contactPhone ?? null,
    membersCount,
    classesCount,
    teachersCount,
    studentsCount,
    joinCode: revealJoinCode ? (school.joinCode ?? null) : null,
    contactUserId: adminRow,
  };
}

async function countAllMembers(schoolId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(schoolMembers)
    .where(eq(schoolMembers.schoolId, schoolId));
  return Number(rows.at(0)?.c ?? 0);
}

async function countClasses(schoolId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(classes)
    .where(eq(classes.schoolId, schoolId));
  return Number(rows.at(0)?.c ?? 0);
}

/**
 * Returns the user id of the first active `admin` member of the school,
 * or null if there is no admin. Used as the contact for direct messaging.
 */
async function findFirstAdminUserId(schoolId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ userId: schoolMembers.userId })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.roleInSchool, "admin"),
        eq(schoolMembers.status, "active"),
      ),
    )
    .orderBy(schoolMembers.createdAt)
    .limit(1);
  return rows.at(0)?.userId ?? null;
}

export interface ListSchoolsFTSQuery {
  search?: string;
  city?: string;
  type?: "public" | "private" | "parochial" | "other";
  page: number;
  pageSize: number;
  /**
   * If provided, the join code of this user's school is revealed in the
   * returned card data (used when the requester is the school's admin).
   */
  revealJoinCodeForSchoolId?: string | null;
  /**
   * When true, the requester is the school's admin and their join code
   * should be revealed on their own school card (matched by id).
   */
  revealJoinCodeForUserId?: string | null;
}

export interface ListSchoolsFTSResult {
  items: SchoolCardData[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * List schools as `SchoolCardData` with full-text search.
 *
 * Uses PostgreSQL `tsvector` (built from `name || ' ' || city || ' ' || region`)
 * with `plainto_tsquery('french', ...)`. Falls back to ILIKE search when FTS
 * is unavailable (e.g. on SQLite, where the `tsvector` function doesn't exist).
 *
 * Falls back gracefully to ILIKE when raw SQL throws.
 */
export async function listSchoolsFTS(
  query: ListSchoolsFTSQuery,
): Promise<ListSchoolsFTSResult> {
  const db = await getDb();
  const page = Math.max(1, query.page);
  const pageSize = Math.min(100, Math.max(1, query.pageSize));
  const offset = (page - 1) * pageSize;

  const conditions: SQL<unknown>[] = [];

  // -- Search: try FTS first, fall back to ILIKE -------------
  if (query.search && query.search.trim().length > 0) {
    const needle = query.search.trim();
    try {
      // Build a tsvector on the fly and match with plainto_tsquery('french', ?).
      const tsvector = sql`to_tsvector('french', coalesce(${schools.name}, '') || ' ' || coalesce(${schools.city}, '') || ' ' || coalesce(${schools.region}, ''))`;
      const tsquery = sql`plainto_tsquery('french', ${needle})`;
      conditions.push(sql`${tsvector} @@ ${tsquery}` as never);
    } catch {
      // Fall back to ILIKE if FTS throws at runtime.
      const likeNeedle = `%${needle}%`;
      conditions.push(
        or(
          ilike(schools.name, likeNeedle),
          ilike(schools.city, likeNeedle),
          ilike(schools.region, likeNeedle),
        ) as never,
      );
    }
  }

  if (query.city && query.city.trim().length > 0) {
    conditions.push(ilike(schools.city, `%${query.city.trim()}%`) as never);
  }
  if (query.type) {
    conditions.push(eq(schools.type, query.type) as never);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schools)
    .where(where)
    .orderBy(desc(schools.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalRow = await db.select({ c: count() }).from(schools).where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  // Determine which school's join code to reveal (if any).
  let revealSchoolId: string | null = null;
  if (query.revealJoinCodeForSchoolId) {
    revealSchoolId = query.revealJoinCodeForSchoolId;
  } else if (query.revealJoinCodeForUserId) {
    // Look up the school the user is admin of.
    const school = await getSchoolForAdminUser(query.revealJoinCodeForUserId);
    if (school) revealSchoolId = school.id;
  }

  const items: SchoolCardData[] = [];
  for (const row of rows) {
    items.push(await toSchoolCardData(row, row.id === revealSchoolId));
  }

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/* -- School detail ------------------------------------------- */

/**
 * Get a single school as `SchoolCardData`, plus the first page of its classes.
 *
 * `revealJoinCode` should be true only when the requester is the school's admin.
 */
export async function getSchoolDetail(
  schoolId: string,
  revealJoinCode: boolean,
): Promise<{ school: SchoolCardData; classes: ClassCardData[] }> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  const school = rows.at(0);
  if (!school) throw AppError.notFound("School not found");

  const card = await toSchoolCardData(school, revealJoinCode);

  // First page of classes (8 items) — the explorer loads the rest.
  const classRows = await db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(desc(classes.createdAt))
    .limit(8);

  const classesData: ClassCardData[] = [];
  for (const cls of classRows) {
    classesData.push(await toClassCardData(cls, school.name));
  }

  return { school: card, classes: classesData };
}

export async function getSchoolCardById(
  schoolId: string,
  revealJoinCode: boolean,
): Promise<SchoolCardData | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  const school = rows.at(0);
  if (!school) return null;
  return toSchoolCardData(school, revealJoinCode);
}

/* -- School classes (paginated) ------------------------------ */

export interface ListSchoolClassesQuery {
  schoolId: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface ListSchoolClassesResult {
  items: ClassCardData[];
  total: number;
  page: number;
  hasMore: boolean;
}

async function toClassCardData(
  cls: {
    id: string;
    name: string;
    level: string | null;
    series: string | null;
    academicYear: string | null;
    schoolId: string;
  },
  schoolName: string,
): Promise<ClassCardData> {
  const [studentsCount, teachersCount, membersCount] = await Promise.all([
    countClassMembersByRole(cls.id, "student"),
    countClassMembersByRole(cls.id, "teacher"),
    countAllClassMembers(cls.id),
  ]);
  return {
    id: cls.id,
    name: cls.name,
    level: cls.level ?? null,
    series: cls.series ?? null,
    academicYear: cls.academicYear ?? null,
    membersCount,
    studentsCount,
    teachersCount,
    schoolName,
  };
}

async function countAllClassMembers(classId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(classMembers)
    .where(eq(classMembers.classId, classId));
  return Number(rows.at(0)?.c ?? 0);
}

/**
 * List classes for a school as `ClassCardData` with pagination + search.
 */
export async function listSchoolClasses(
  query: ListSchoolClassesQuery,
): Promise<ListSchoolClassesResult> {
  const db = await getDb();
  const page = Math.max(1, query.page);
  const pageSize = Math.min(100, Math.max(1, query.pageSize));
  const offset = (page - 1) * pageSize;

  // Fetch the school name once.
  const schoolRows = await db
    .select({ name: schools.name })
    .from(schools)
    .where(eq(schools.id, query.schoolId))
    .limit(1);
  const schoolName = schoolRows.at(0)?.name ?? "";

  const conditions: SQL<unknown>[] = [
    eq(classes.schoolId, query.schoolId) as never,
  ];
  if (query.search && query.search.trim().length > 0) {
    const needle = `%${query.search.trim()}%`;
    conditions.push(
      or(
        ilike(classes.name, needle),
        ilike(classes.academicYear, needle),
      ) as never,
    );
  }

  const where = and(...conditions);

  const rows = await db
    .select()
    .from(classes)
    .where(where)
    .orderBy(desc(classes.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalRow = await db.select({ c: count() }).from(classes).where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  const items: ClassCardData[] = [];
  for (const cls of rows) {
    items.push(
      await toClassCardData(
        {
          id: cls.id,
          name: cls.name,
          level: cls.level ?? null,
          series: cls.series ?? null,
          academicYear: cls.academicYear ?? null,
          schoolId: cls.schoolId,
        },
        schoolName,
      ),
    );
  }

  return {
    items,
    total,
    page,
    hasMore: page * pageSize < total,
  };
}
