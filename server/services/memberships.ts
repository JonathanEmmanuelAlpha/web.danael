/**
 * Memberships service — invitations, join requests, join-by-code.
 *
 * Centralise toute la logique métier liée aux invitations in-app,
 * demandes de rejoindre (request-to-join), et adhésion par code d'accès.
 *
 * Toutes les fonctions retournent des données typées. Les server actions
 * dans server/actions/memberships.ts se contentent d'appeler ces fonctions
 * en gérant l'auth + RBAC + Zod validation.
 */

import { eq, and, desc, isNull, or, lt, sql, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  schools,
  schoolMembers,
  classes,
  classMembers,
  invitations,
  schoolJoinRequests,
  classJoinRequests,
  type School,
  type Class,
  type Invitation,
  type SchoolJoinRequest,
  type ClassJoinRequest,
} from "@/server/db/schema/schools";
import { users } from "@/server/db/schema/users";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { nanoid } from "nanoid";

/* ── Helpers ───────────────────────────────────────────────────── */

/**
 * Generate a short human-readable join code (6 uppercase alphanumeric).
 * Avoids ambiguous characters (0/O, 1/I).
 */
export function generateJoinCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * Returns a non-null school row by id, or throws 404.
 */
async function requireSchool(schoolId: string): Promise<School> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!rows[0]) throw AppError.notFound("School not found");
  return rows[0];
}

async function requireClass(classId: string): Promise<Class> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);
  if (!rows[0]) throw AppError.notFound("Class not found");
  return rows[0];
}

/* ── Join by code ──────────────────────────────────────────────── */

/**
 * Find a school by its joinCode (case-insensitive).
 * Returns null if not found.
 */
export async function findSchoolByJoinCode(
  code: string,
): Promise<School | null> {
  const db = await getDb();
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const rows = await db
    .select()
    .from(schools)
    .where(eq(schools.joinCode, normalized))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Find a class by its inviteCode (case-insensitive).
 */
export async function findClassByInviteCode(
  code: string,
): Promise<Class | null> {
  const db = await getDb();
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const rows = await db
    .select()
    .from(classes)
    .where(eq(classes.inviteCode, normalized))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Join a school by code. Creates a school_member row with status "active"
 * and the specified role. If already a member, returns the existing row.
 */
export async function joinSchoolByCode(params: {
  userId: string;
  code: string;
  roleInSchool?: "admin" | "teacher" | "student" | "parent" | "staff";
}): Promise<{ school: School; member: typeof schoolMembers.$inferSelect }> {
  const school = await findSchoolByJoinCode(params.code);
  if (!school) {
    throw AppError.notFound("Aucune école trouvée avec ce code d'accès");
  }

  const db = await getDb();
  // Check existing membership
  const existing = await db
    .select()
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, school.id),
        eq(schoolMembers.userId, params.userId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    // If revoked, reactivate
    if (existing[0].status === "revoked") {
      const [updated] = await db
        .update(schoolMembers)
        .set({ status: "active", joinedAt: new Date() })
        .where(eq(schoolMembers.id, existing[0].id))
        .returning();
      return { school, member: updated };
    }
    return { school, member: existing[0] };
  }

  const roleInSchool = params.roleInSchool ?? "student";
  const [member] = await db
    .insert(schoolMembers)
    .values({
      schoolId: school.id,
      userId: params.userId,
      roleInSchool,
      status: "active",
      joinedAt: new Date(),
    })
    .returning();

  logger.info("User joined school by code", {
    schoolId: school.id,
    userId: params.userId,
    roleInSchool,
  });

  return { school, member };
}

/**
 * Join a class by invite code.
 *
 * The user MUST be a member of the school that owns the class before they
 * can join the class itself. This prevents users from joining classes in
 * schools they don't belong to (even with a valid invite code).
 */
export async function joinClassByCode(params: {
  userId: string;
  code: string;
  role?: "admin" | "teacher" | "student" | "parent" | "staff";
}): Promise<{ class: Class; member: typeof classMembers.$inferSelect }> {
  const cls = await findClassByInviteCode(params.code);
  if (!cls) {
    throw AppError.notFound("Aucune classe trouvée avec ce code d'invitation");
  }

  const db = await getDb();

  // Check that the user is a member of the school that owns the class.
  const schoolMember = await db
    .select({ id: schoolMembers.id })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, cls.schoolId),
        eq(schoolMembers.userId, params.userId),
      ),
    )
    .limit(1);
  if (schoolMember.length === 0) {
    throw AppError.forbidden(
      "Vous devez d'abord rejoindre l'établissement avant de pouvoir rejoindre une classe",
    );
  }

  const existing = await db
    .select()
    .from(classMembers)
    .where(
      and(
        eq(classMembers.classId, cls.id),
        eq(classMembers.userId, params.userId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { class: cls, member: existing[0] };
  }

  const role = params.role ?? "student";
  const [member] = await db
    .insert(classMembers)
    .values({
      classId: cls.id,
      userId: params.userId,
      role,
    })
    .returning();

  logger.info("User joined class by code", {
    classId: cls.id,
    userId: params.userId,
    role,
  });

  return { class: cls, member };
}

/* ── Join requests (request-to-join workflow) ─────────────────── */

/**
 * Create a join request for a school. Idempotent: if a pending request
 * already exists for the same user+school, returns it without creating
 * a duplicate.
 */
export async function requestToJoinSchool(params: {
  schoolId: string;
  userId: string;
  roleInSchool: "admin" | "teacher" | "student" | "parent" | "staff";
  message?: string;
}): Promise<SchoolJoinRequest> {
  await requireSchool(params.schoolId);
  const db = await getDb();

  // Check if user is already a member
  const existingMember = await db
    .select()
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, params.schoolId),
        eq(schoolMembers.userId, params.userId),
        ne(schoolMembers.status, "revoked"),
      ),
    )
    .limit(1);
  if (existingMember[0]) {
    throw AppError.validation("Vous êtes déjà membre de cette école");
  }

  // Check existing pending request
  const existingReq = await db
    .select()
    .from(schoolJoinRequests)
    .where(
      and(
        eq(schoolJoinRequests.schoolId, params.schoolId),
        eq(schoolJoinRequests.userId, params.userId),
        eq(schoolJoinRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (existingReq[0]) {
    return existingReq[0];
  }

  const [req] = await db
    .insert(schoolJoinRequests)
    .values({
      schoolId: params.schoolId,
      userId: params.userId,
      roleInSchool: params.roleInSchool,
      message: params.message,
      status: "pending",
    })
    .returning();

  logger.info("Join request created (school)", {
    schoolId: params.schoolId,
    userId: params.userId,
    requestId: req.id,
  });

  return req;
}

/**
 * Create a join request for a class.
 */
export async function requestToJoinClass(params: {
  classId: string;
  userId: string;
  role?: "admin" | "teacher" | "student" | "parent" | "staff";
  message?: string;
}): Promise<ClassJoinRequest> {
  await requireClass(params.classId);
  const db = await getDb();

  const existingMember = await db
    .select()
    .from(classMembers)
    .where(
      and(
        eq(classMembers.classId, params.classId),
        eq(classMembers.userId, params.userId),
      ),
    )
    .limit(1);
  if (existingMember[0]) {
    throw AppError.validation("Vous êtes déjà membre de cette classe");
  }

  const existingReq = await db
    .select()
    .from(classJoinRequests)
    .where(
      and(
        eq(classJoinRequests.classId, params.classId),
        eq(classJoinRequests.userId, params.userId),
        eq(classJoinRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (existingReq[0]) {
    return existingReq[0];
  }

  const [req] = await db
    .insert(classJoinRequests)
    .values({
      classId: params.classId,
      userId: params.userId,
      role: params.role ?? "student",
      message: params.message,
      status: "pending",
    })
    .returning();

  logger.info("Join request created (class)", {
    classId: params.classId,
    userId: params.userId,
    requestId: req.id,
  });

  return req;
}

/**
 * Approve a school join request — creates a school_member row and
 * marks the request as approved.
 */
export async function approveSchoolJoinRequest(params: {
  requestId: string;
  decidedBy: string;
  adminNote?: string;
}): Promise<{
  request: SchoolJoinRequest;
  member: typeof schoolMembers.$inferSelect;
}> {
  const db = await getDb();
  const [req] = await db
    .select()
    .from(schoolJoinRequests)
    .where(eq(schoolJoinRequests.id, params.requestId))
    .limit(1);
  if (!req) throw AppError.notFound("Demande introuvable");
  if (req.status !== "pending") {
    throw AppError.validation("Cette demande a déjà été traitée");
  }

  const [updatedReq] = await db
    .update(schoolJoinRequests)
    .set({
      status: "approved",
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
      adminNote: params.adminNote,
    })
    .where(eq(schoolJoinRequests.id, req.id))
    .returning();

  // Create the membership
  const [member] = await db
    .insert(schoolMembers)
    .values({
      schoolId: req.schoolId,
      userId: req.userId,
      roleInSchool: req.roleInSchool,
      status: "active",
      joinedAt: new Date(),
    })
    .returning();

  logger.info("School join request approved", {
    requestId: req.id,
    userId: req.userId,
    schoolId: req.schoolId,
    decidedBy: params.decidedBy,
  });

  return { request: updatedReq, member };
}

export async function rejectSchoolJoinRequest(params: {
  requestId: string;
  decidedBy: string;
  adminNote?: string;
}): Promise<SchoolJoinRequest> {
  const db = await getDb();
  const [req] = await db
    .select()
    .from(schoolJoinRequests)
    .where(eq(schoolJoinRequests.id, params.requestId))
    .limit(1);
  if (!req) throw AppError.notFound("Demande introuvable");
  if (req.status !== "pending") {
    throw AppError.validation("Cette demande a déjà été traitée");
  }

  const [updated] = await db
    .update(schoolJoinRequests)
    .set({
      status: "rejected",
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
      adminNote: params.adminNote,
    })
    .where(eq(schoolJoinRequests.id, req.id))
    .returning();

  return updated;
}

export async function approveClassJoinRequest(params: {
  requestId: string;
  decidedBy: string;
  adminNote?: string;
}): Promise<{
  request: ClassJoinRequest;
  member: typeof classMembers.$inferSelect;
}> {
  const db = await getDb();
  const [req] = await db
    .select()
    .from(classJoinRequests)
    .where(eq(classJoinRequests.id, params.requestId))
    .limit(1);
  if (!req) throw AppError.notFound("Demande introuvable");
  if (req.status !== "pending") {
    throw AppError.validation("Cette demande a déjà été traitée");
  }

  const [updatedReq] = await db
    .update(classJoinRequests)
    .set({
      status: "approved",
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
      adminNote: params.adminNote,
    })
    .where(eq(classJoinRequests.id, req.id))
    .returning();

  const [member] = await db
    .insert(classMembers)
    .values({
      classId: req.classId,
      userId: req.userId,
      role: req.role,
    })
    .returning();

  logger.info("Class join request approved", {
    requestId: req.id,
    userId: req.userId,
    classId: req.classId,
    decidedBy: params.decidedBy,
  });

  return { request: updatedReq, member };
}

export async function rejectClassJoinRequest(params: {
  requestId: string;
  decidedBy: string;
  adminNote?: string;
}): Promise<ClassJoinRequest> {
  const db = await getDb();
  const [req] = await db
    .select()
    .from(classJoinRequests)
    .where(eq(classJoinRequests.id, params.requestId))
    .limit(1);
  if (!req) throw AppError.notFound("Demande introuvable");
  if (req.status !== "pending") {
    throw AppError.validation("Cette demande a déjà été traitée");
  }

  const [updated] = await db
    .update(classJoinRequests)
    .set({
      status: "rejected",
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
      adminNote: params.adminNote,
    })
    .where(eq(classJoinRequests.id, req.id))
    .returning();

  return updated;
}

/**
 * Cancel a join request (by the requester themselves).
 */
export async function cancelSchoolJoinRequest(
  requestId: string,
  userId: string,
): Promise<SchoolJoinRequest> {
  const db = await getDb();
  const [req] = await db
    .select()
    .from(schoolJoinRequests)
    .where(eq(schoolJoinRequests.id, requestId))
    .limit(1);
  if (!req) throw AppError.notFound("Demande introuvable");
  if (req.userId !== userId) {
    throw AppError.forbidden("Vous ne pouvez pas annuler cette demande");
  }
  if (req.status !== "pending") {
    throw AppError.validation("Cette demande a déjà été traitée");
  }
  const [updated] = await db
    .update(schoolJoinRequests)
    .set({ status: "cancelled" })
    .where(eq(schoolJoinRequests.id, requestId))
    .returning();
  return updated;
}

export async function cancelClassJoinRequest(
  requestId: string,
  userId: string,
): Promise<ClassJoinRequest> {
  const db = await getDb();
  const [req] = await db
    .select()
    .from(classJoinRequests)
    .where(eq(classJoinRequests.id, requestId))
    .limit(1);
  if (!req) throw AppError.notFound("Demande introuvable");
  if (req.userId !== userId) {
    throw AppError.forbidden("Vous ne pouvez pas annuler cette demande");
  }
  if (req.status !== "pending") {
    throw AppError.validation("Cette demande a déjà été traitée");
  }
  const [updated] = await db
    .update(classJoinRequests)
    .set({ status: "cancelled" })
    .where(eq(classJoinRequests.id, requestId))
    .returning();
  return updated;
}

/* ── Queries: list requests ───────────────────────────────────── */

export async function listMyJoinRequests(userId: string): Promise<
  Array<
    SchoolJoinRequest & {
      schoolName: string;
      schoolCity: string | null;
    }
  >
> {
  const db = await getDb();
  const rows = await db
    .select({
      request: schoolJoinRequests,
      schoolName: schools.name,
      schoolCity: schools.city,
    })
    .from(schoolJoinRequests)
    .innerJoin(schools, eq(schoolJoinRequests.schoolId, schools.id))
    .where(eq(schoolJoinRequests.userId, userId))
    .orderBy(desc(schoolJoinRequests.createdAt));
  return rows.map((r) => ({
    ...r.request,
    schoolName: r.schoolName,
    schoolCity: r.schoolCity,
  }));
}

export async function listMyClassJoinRequests(userId: string): Promise<
  Array<
    ClassJoinRequest & {
      className: string;
      schoolName: string;
    }
  >
> {
  const db = await getDb();
  const rows = await db
    .select({
      request: classJoinRequests,
      className: classes.name,
      schoolName: schools.name,
    })
    .from(classJoinRequests)
    .innerJoin(classes, eq(classJoinRequests.classId, classes.id))
    .innerJoin(schools, eq(classes.schoolId, schools.id))
    .where(eq(classJoinRequests.userId, userId))
    .orderBy(desc(classJoinRequests.createdAt));
  return rows.map((r) => ({
    ...r.request,
    className: r.className,
    schoolName: r.schoolName,
  }));
}

export async function listSchoolJoinRequests(params: {
  schoolId: string;
  status?: "pending" | "approved" | "rejected" | "cancelled";
}): Promise<
  Array<
    SchoolJoinRequest & {
      userName: string;
      userEmail: string;
      userAvatarUrl: string | null;
    }
  >
> {
  const db = await getDb();
  const conditions = [eq(schoolJoinRequests.schoolId, params.schoolId)];
  if (params.status)
    conditions.push(eq(schoolJoinRequests.status, params.status));

  const rows = await db
    .select({
      request: schoolJoinRequests,
      userName: users.firstName,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(schoolJoinRequests)
    .innerJoin(users, eq(schoolJoinRequests.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(schoolJoinRequests.createdAt));

  return rows.map((r) => ({
    ...r.request,
    userName: r.userName ?? "—",
    userEmail: r.userEmail,
    userAvatarUrl: r.userAvatarUrl,
  }));
}

export async function listClassJoinRequests(params: {
  classId: string;
  status?: "pending" | "approved" | "rejected" | "cancelled";
}): Promise<
  Array<
    ClassJoinRequest & {
      userName: string;
      userEmail: string;
      userAvatarUrl: string | null;
    }
  >
> {
  const db = await getDb();
  const conditions = [
    eq(classJoinRequests.classId, params.classId),
    ...(params.status ? [eq(classJoinRequests.status, params.status)] : []),
  ];
  const rows = await db
    .select({
      request: classJoinRequests,
      userName: users.firstName,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(classJoinRequests)
    .innerJoin(users, eq(classJoinRequests.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(classJoinRequests.createdAt));

  return rows.map((r) => ({
    ...r.request,
    userName: r.userName ?? "—",
    userEmail: r.userEmail,
    userAvatarUrl: r.userAvatarUrl,
  }));
}

/* ── In-app invitations ───────────────────────────────────────── */

/**
 * Create an invitation (in-app + email best-effort).
 *
 * If the invitee is already a member, throws validation error.
 * If a pending invitation already exists, returns it.
 */
export async function createInvitation(params: {
  targetType: "school" | "class";
  targetId: string;
  inviteeUserId?: string;
  inviteeEmail?: string;
  roleInTarget: "admin" | "teacher" | "student" | "parent" | "staff";
  invitedBy: string;
  message?: string;
}): Promise<Invitation> {
  if (!params.inviteeUserId && !params.inviteeEmail) {
    throw AppError.validation(
      "Either inviteeUserId or inviteeEmail is required",
    );
  }

  const db = await getDb();

  // Check existing pending invitation
  const conditions = [
    eq(invitations.targetType, params.targetType),
    eq(invitations.targetId, params.targetId),
    eq(invitations.status, "pending"),
    params.inviteeUserId
      ? eq(invitations.inviteeUserId, params.inviteeUserId)
      : eq(invitations.inviteeEmail, params.inviteeEmail ?? ""),
  ];
  const existing = await db
    .select()
    .from(invitations)
    .where(and(...conditions))
    .limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const [inv] = await db
    .insert(invitations)
    .values({
      targetType: params.targetType,
      targetId: params.targetId,
      inviteeUserId: params.inviteeUserId,
      inviteeEmail: params.inviteeEmail,
      roleInTarget: params.roleInTarget,
      invitedBy: params.invitedBy,
      message: params.message,
      status: "pending",
      expiresAt,
    })
    .returning();

  logger.info("Invitation created", {
    invitationId: inv.id,
    targetType: params.targetType,
    targetId: params.targetId,
    inviteeUserId: params.inviteeUserId,
    inviteeEmail: params.inviteeEmail,
    invitedBy: params.invitedBy,
  });

  return inv;
}

/**
 * Accept an invitation — creates the membership and marks invitation accepted.
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string,
): Promise<{ invitation: Invitation; school?: School; class?: Class }> {
  const db = await getDb();
  const [inv] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);
  if (!inv) throw AppError.notFound("Invitation introuvable");

  // Verify the invitation is for this user
  if (inv.inviteeUserId && inv.inviteeUserId !== userId) {
    throw AppError.forbidden("Cette invitation ne vous est pas destinée");
  }
  if (inv.inviteeEmail) {
    // Look up user by email
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.email, inv.inviteeEmail))
      .limit(1);
    if (!u || u.id !== userId) {
      throw AppError.forbidden("Cette invitation ne vous est pas destinée");
    }
  }
  if (inv.status !== "pending") {
    throw AppError.validation("Cette invitation a déjà été traitée");
  }
  if (inv.expiresAt && inv.expiresAt < new Date()) {
    await db
      .update(invitations)
      .set({ status: "expired" })
      .where(eq(invitations.id, invitationId));
    throw AppError.validation("Cette invitation a expiré");
  }

  // Create the membership
  let school: School | undefined;
  let cls: Class | undefined;

  if (inv.targetType === "school") {
    school = await requireSchool(inv.targetId);
    // Check existing membership
    const existing = await db
      .select()
      .from(schoolMembers)
      .where(
        and(
          eq(schoolMembers.schoolId, inv.targetId),
          eq(schoolMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      await db.insert(schoolMembers).values({
        schoolId: inv.targetId,
        userId,
        roleInSchool: inv.roleInTarget,
        status: "active",
        joinedAt: new Date(),
      });
    } else if (existing[0].status === "revoked") {
      await db
        .update(schoolMembers)
        .set({ status: "active", joinedAt: new Date() })
        .where(eq(schoolMembers.id, existing[0].id));
    }
  } else {
    cls = await requireClass(inv.targetId);
    const existing = await db
      .select()
      .from(classMembers)
      .where(
        and(
          eq(classMembers.classId, inv.targetId),
          eq(classMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      await db.insert(classMembers).values({
        classId: inv.targetId,
        userId,
        role: inv.roleInTarget,
      });
    }
  }

  const [updated] = await db
    .update(invitations)
    .set({ status: "accepted", decidedAt: new Date() })
    .where(eq(invitations.id, invitationId))
    .returning();

  logger.info("Invitation accepted", {
    invitationId,
    userId,
    targetType: inv.targetType,
    targetId: inv.targetId,
  });

  return { invitation: updated, school, class: cls };
}

export async function rejectInvitation(
  invitationId: string,
  userId: string,
): Promise<Invitation> {
  const db = await getDb();
  const [inv] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);
  if (!inv) throw AppError.notFound("Invitation introuvable");
  if (inv.inviteeUserId && inv.inviteeUserId !== userId) {
    throw AppError.forbidden("Cette invitation ne vous est pas destinée");
  }
  if (inv.status !== "pending") {
    throw AppError.validation("Cette invitation a déjà été traitée");
  }
  const [updated] = await db
    .update(invitations)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(eq(invitations.id, invitationId))
    .returning();
  return updated;
}

/**
 * List invitations received by the current user (pending + recently decided).
 */
export async function listMyInvitations(userId: string): Promise<
  Array<{
    invitation: Invitation;
    targetName: string;
    targetCity: string | null;
    invitedByName: string;
    invitedByAvatarUrl: string | null;
  }>
> {
  const db = await getDb();

  // Get user's email to also match invitations by email
  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) return [];

  // Build the query: invitations where inviteeUserId = userId OR inviteeEmail = userRow.email
  const inviteeCondition = or(
    eq(invitations.inviteeUserId, userId),
    eq(invitations.inviteeEmail, userRow.email),
  );

  // Fetch all invitations for this user
  const allInvs = await db
    .select()
    .from(invitations)
    .where(inviteeCondition)
    .orderBy(desc(invitations.createdAt))
    .limit(50);

  if (allInvs.length === 0) return [];

  // Enrich with target + inviter info
  const result: Array<{
    invitation: Invitation;
    targetName: string;
    targetCity: string | null;
    invitedByName: string;
    invitedByAvatarUrl: string | null;
  }> = [];

  for (const inv of allInvs) {
    let targetName = "—";
    let targetCity: string | null = null;
    if (inv.targetType === "school") {
      const [s] = await db
        .select()
        .from(schools)
        .where(eq(schools.id, inv.targetId))
        .limit(1);
      if (s) {
        targetName = s.name;
        targetCity = s.city;
      }
    } else {
      const [c] = await db
        .select()
        .from(classes)
        .where(eq(classes.id, inv.targetId))
        .limit(1);
      if (c) {
        targetName = c.name;
      }
    }

    const [inviter] = await db
      .select()
      .from(users)
      .where(eq(users.id, inv.invitedBy))
      .limit(1);

    result.push({
      invitation: inv,
      targetName,
      targetCity,
      invitedByName: inviter
        ? [inviter.firstName, inviter.lastName].filter(Boolean).join(" ") ||
          inviter.email
        : "—",
      invitedByAvatarUrl: inviter?.avatarUrl ?? null,
    });
  }

  return result;
}

/**
 * List invitations sent by a user (for school admin / teacher dashboard).
 */
export async function listSentInvitations(params: {
  targetType: "school" | "class";
  targetId: string;
  status?: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
}): Promise<
  Array<{
    invitation: Invitation;
    inviteeName: string;
    inviteeEmail: string;
    inviteeAvatarUrl: string | null;
  }>
> {
  const db = await getDb();
  const conditions = [
    eq(invitations.targetType, params.targetType),
    eq(invitations.targetId, params.targetId),
    ...(params.status ? [eq(invitations.status, params.status)] : []),
  ];
  const rows = await db
    .select({
      invitation: invitations,
      inviteeFirstName: users.firstName,
      inviteeLastName: users.lastName,
      inviteeEmail: users.email,
      inviteeAvatarUrl: users.avatarUrl,
    })
    .from(invitations)
    .leftJoin(users, eq(invitations.inviteeUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(invitations.createdAt));

  return rows.map((r) => ({
    invitation: r.invitation,
    inviteeName: [r.inviteeFirstName, r.inviteeLastName]
      .filter(Boolean)
      .join(" "),
    inviteeEmail: r.inviteeEmail ?? r.invitation.inviteeEmail ?? "—",
    inviteeAvatarUrl: r.inviteeAvatarUrl ?? null,
  }));
}

/**
 * Cancel an invitation (by the inviter or school admin).
 */
export async function cancelInvitation(
  invitationId: string,
): Promise<Invitation> {
  const db = await getDb();
  const [inv] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);
  if (!inv) throw AppError.notFound("Invitation introuvable");
  if (inv.status !== "pending") {
    throw AppError.validation("Cette invitation a déjà été traitée");
  }
  const [updated] = await db
    .update(invitations)
    .set({ status: "cancelled", decidedAt: new Date() })
    .where(eq(invitations.id, invitationId))
    .returning();
  return updated;
}
