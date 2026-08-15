/**
 * School access codes and admin access management.
 *
 * Allows school creators to generate access codes so other school_admins
 * can request to co-manage their school.
 *
 * Flow:
 *   1. School creator generates an access code (maxUsages / expiresInSeconds)
 *   2. Another school_admin enters the code on onboarding/school (Join tab)
 *   3. A school_admin_access row is created with status "pending" + usages++
 *   4. The school creator sees the request in /access-requests
 *   5. On approve → the requester is added as a school_member (role="admin")
 *
 * All functions return typed data. Server actions in
 * `server/actions/school-access.ts` wrap these with auth + RBAC + Zod.
 */

import { eq, and, desc, lt, sql, ne } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  schools,
  schoolMembers,
  schoolAccessCodes,
  schoolAdminAccess,
  type School,
  type SchoolAccessCode,
  type SchoolAdminAccess,
} from "@/server/db/schema/schools";
import { users } from "@/server/db/schema/users";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/* -- Helpers ----------------------------------------------------- */

/**
 * Generate a random 10-char access code (uppercase alphanumeric, no ambiguous
 * chars like 0/O or 1/I).
 */
export function generateAccessCode(length = 10): string {
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

/**
 * Ensure the requesting user is an active admin of the given school.
 * Returns the membership row.
 */
async function requireSchoolAdminMembership(schoolId: string, userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId),
        eq(schoolMembers.roleInSchool, "admin"),
        ne(schoolMembers.status, "revoked"),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw AppError.forbidden(
      "Seul un administrateur de l'établissement peut effectuer cette action",
    );
  }
  return rows[0];
}

/* -- Create / validate access codes ----------------------------- */

/**
 * Create a new access code for a school.
 *
 * - `maxUsages` null  → unlimited usages
 * - `expiresInSeconds` null → never expires
 * - Generated code is guaranteed unique (retries on collision).
 */
export async function createAccessCode(params: {
  schoolId: string;
  createdBy: string;
  maxUsages?: number | null;
  expiresInSeconds?: number | null;
}): Promise<SchoolAccessCode> {
  await requireSchool(params.schoolId);
  await requireSchoolAdminMembership(params.schoolId, params.createdBy);

  const db = await getDb();

  // Compute expiry date
  let expiresAt: Date | null = null;
  if (params.expiresInSeconds && params.expiresInSeconds > 0) {
    expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);
  }

  // Generate a unique code (retry up to 5 times on collision)
  let code = generateAccessCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db
      .select({ id: schoolAccessCodes.id })
      .from(schoolAccessCodes)
      .where(eq(schoolAccessCodes.accessCode, code))
      .limit(1);
    if (existing.length === 0) break;
    code = generateAccessCode();
  }

  const [created] = await db
    .insert(schoolAccessCodes)
    .values({
      schoolId: params.schoolId,
      accessCode: code,
      createdBy: params.createdBy,
      usages: 0,
      maxUsages: params.maxUsages ?? null,
      expiresAt,
      isActive: true,
    })
    .returning();

  if (!created) {
    throw AppError.internal("Failed to create access code");
  }

  logger.info("Access code created", {
    schoolId: params.schoolId,
    codeId: created.id,
    byUserId: params.createdBy,
  });

  return created;
}

/**
 * Validate an access code.
 *
 * Returns `{ valid: true, schoolId, codeId }` if the code exists, is active,
 * has not expired, and has not reached its max usages.
 */
export async function validateAccessCode(code: string): Promise<{
  valid: boolean;
  schoolId?: string;
  codeId?: string;
  reason?: string;
}> {
  const db = await getDb();
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, reason: "Code requis" };
  }

  const rows = await db
    .select()
    .from(schoolAccessCodes)
    .where(eq(schoolAccessCodes.accessCode, normalized))
    .limit(1);

  const codeRow = rows[0];
  if (!codeRow) {
    return { valid: false, reason: "Code introuvable" };
  }
  if (!codeRow.isActive) {
    return { valid: false, reason: "Ce code a été désactivé" };
  }
  if (codeRow.expiresAt && codeRow.expiresAt < new Date()) {
    return { valid: false, reason: "Ce code a expiré" };
  }
  if (codeRow.maxUsages !== null && codeRow.usages >= codeRow.maxUsages) {
    return {
      valid: false,
      reason: "Ce code a atteint son nombre d'utilisations maximum",
    };
  }

  return {
    valid: true,
    schoolId: codeRow.schoolId,
    codeId: codeRow.id,
  };
}

/* -- Request access --------------------------------------------- */

/**
 * Create an access request from a school_admin to co-manage a school.
 *
 * - Validates the access code
 * - Checks if a request already exists (unique constraint on schoolId+schoolAdminId)
 * - Inserts a school_admin_access row with status "pending"
 * - Increments `usages` on the code
 *
 * If an existing request is already pending/approved/rejected, returns it
 * (idempotent — does not double-charge the code).
 */
export async function requestSchoolAdminAccess(params: {
  schoolAdminId: string;
  accessCode: string;
}): Promise<{ requestId: string; status: string; schoolName?: string }> {
  const db = await getDb();

  // Validate the code
  const validation = await validateAccessCode(params.accessCode);
  if (!validation.valid || !validation.schoolId || !validation.codeId) {
    throw AppError.validation(validation.reason ?? "Code d'accès invalide");
  }

  const { schoolId, codeId } = validation;

  // Ensure the user is a school_admin (role check)
  const [userRow] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, params.schoolAdminId))
    .limit(1);
  if (!userRow) {
    throw AppError.notFound("Utilisateur introuvable");
  }
  if (userRow.role !== "school_admin" && userRow.role !== "platform_admin") {
    throw AppError.unauthorized(
      "Seuls les administrateurs d'établissement peuvent demander l'accès",
    );
  }

  // Already a member? Don't allow duplicate
  const existingMember = await db
    .select({ id: schoolMembers.id })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, params.schoolAdminId),
        ne(schoolMembers.status, "revoked"),
      ),
    )
    .limit(1);
  if (existingMember[0]) {
    throw AppError.validation("Vous êtes déjà membre de cet établissement");
  }

  // Check for an existing request (any status — idempotent)
  const existingReq = await db
    .select()
    .from(schoolAdminAccess)
    .where(
      and(
        eq(schoolAdminAccess.schoolId, schoolId),
        eq(schoolAdminAccess.schoolAdminId, params.schoolAdminId),
      ),
    )
    .limit(1);

  if (existingReq[0]) {
    // Existing request — return its status without re-incrementing usages
    const [schoolRow] = await db
      .select({ name: schools.name })
      .from(schools)
      .where(eq(schools.id, schoolId))
      .limit(1);

    return {
      requestId: existingReq[0].id,
      status: existingReq[0].status,
      schoolName: schoolRow?.name,
    };
  }

  // Create the request
  const [created] = await db
    .insert(schoolAdminAccess)
    .values({
      schoolId,
      schoolAdminId: params.schoolAdminId,
      schoolAccessCodeId: codeId,
      status: "pending",
    })
    .returning();

  if (!created) {
    throw AppError.internal("Failed to create access request");
  }

  // Increment usages on the code
  await db
    .update(schoolAccessCodes)
    .set({ usages: sql`${schoolAccessCodes.usages} + 1` })
    .where(eq(schoolAccessCodes.id, codeId));

  const [schoolRow] = await db
    .select({ name: schools.name })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);

  logger.info("School admin access requested", {
    requestId: created.id,
    schoolId,
    schoolAdminId: params.schoolAdminId,
    codeId,
  });

  return {
    requestId: created.id,
    status: created.status,
    schoolName: schoolRow?.name,
  };
}

/* -- List access requests --------------------------------------- */

/**
 * List access requests for a school (for the school creator to approve/reject).
 * Joins `users` to surface adminName / adminEmail / adminAvatarUrl.
 */
export async function listAccessRequests(params: {
  schoolId: string;
  status?: "pending" | "approved" | "rejected" | "cancelled";
}): Promise<
  Array<
    SchoolAdminAccess & {
      adminName: string;
      adminEmail: string;
      adminAvatarUrl: string | null;
    }
  >
> {
  const db = await getDb();

  const conditions = [
    eq(schoolAdminAccess.schoolId, params.schoolId),
    ...(params.status ? [eq(schoolAdminAccess.status, params.status)] : []),
  ];

  const rows = await db
    .select({
      request: schoolAdminAccess,
      adminName: users.firstName,
      adminLastName: users.lastName,
      adminEmail: users.email,
      adminAvatarUrl: users.avatarUrl,
    })
    .from(schoolAdminAccess)
    .innerJoin(users, eq(users.id, schoolAdminAccess.schoolAdminId))
    .where(and(...conditions))
    .orderBy(desc(schoolAdminAccess.createdAt));

  return rows.map((r) => ({
    ...r.request,
    adminName: [r.adminName, r.adminLastName].filter(Boolean).join(" ") || "—",
    adminEmail: r.adminEmail,
    adminAvatarUrl: r.adminAvatarUrl,
  }));
}

/* -- Approve / reject ------------------------------------------- */

/**
 * Approve an access request — adds the school_admin as a member with
 * role="admin" and status="active".
 */
export async function approveAccessRequest(params: {
  requestId: string;
  decidedBy: string;
}): Promise<{ status: string; memberId: string }> {
  const db = await getDb();

  const [req] = await db
    .select()
    .from(schoolAdminAccess)
    .where(eq(schoolAdminAccess.id, params.requestId))
    .limit(1);
  if (!req) throw AppError.notFound("Demande introuvable");
  if (req.status !== "pending") {
    throw AppError.validation("Cette demande a déjà été traitée");
  }

  // Ensure the deciding user is an admin of the school
  await requireSchoolAdminMembership(req.schoolId, params.decidedBy);

  // Update the request
  const [updatedReq] = await db
    .update(schoolAdminAccess)
    .set({
      status: "approved",
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
    })
    .where(eq(schoolAdminAccess.id, req.id))
    .returning();

  if (!updatedReq) {
    throw AppError.internal("Failed to approve request");
  }

  // Add the requester as an admin member of the school.
  // Idempotent: if a revoked membership exists, reactivate it.
  const existingMember = await db
    .select()
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, req.schoolId),
        eq(schoolMembers.userId, req.schoolAdminId),
      ),
    )
    .limit(1);

  let memberId: string;

  if (existingMember[0]) {
    const [reactivated] = await db
      .update(schoolMembers)
      .set({
        roleInSchool: "admin",
        status: "active",
        joinedAt: new Date(),
        invitedBy: params.decidedBy,
      })
      .where(eq(schoolMembers.id, existingMember[0].id))
      .returning();
    memberId = reactivated?.id ?? existingMember[0].id;
  } else {
    const [member] = await db
      .insert(schoolMembers)
      .values({
        schoolId: req.schoolId,
        userId: req.schoolAdminId,
        roleInSchool: "admin",
        status: "active",
        invitedBy: params.decidedBy,
        joinedAt: new Date(),
      })
      .returning();
    if (!member) {
      throw AppError.internal("Failed to add member");
    }
    memberId = member.id;
  }

  logger.info("Access request approved", {
    requestId: req.id,
    schoolId: req.schoolId,
    schoolAdminId: req.schoolAdminId,
    memberId,
    decidedBy: params.decidedBy,
  });

  return { status: updatedReq.status, memberId };
}

/**
 * Reject an access request.
 */
export async function rejectAccessRequest(params: {
  requestId: string;
  decidedBy: string;
  adminNote?: string;
}): Promise<SchoolAdminAccess> {
  const db = await getDb();

  const [req] = await db
    .select()
    .from(schoolAdminAccess)
    .where(eq(schoolAdminAccess.id, params.requestId))
    .limit(1);
  if (!req) throw AppError.notFound("Demande introuvable");
  if (req.status !== "pending") {
    throw AppError.validation("Cette demande a déjà été traitée");
  }

  // Ensure the deciding user is an admin of the school
  await requireSchoolAdminMembership(req.schoolId, params.decidedBy);

  const [updated] = await db
    .update(schoolAdminAccess)
    .set({
      status: "rejected",
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
      adminNote: params.adminNote,
    })
    .where(eq(schoolAdminAccess.id, req.id))
    .returning();

  if (!updated) {
    throw AppError.internal("Failed to reject request");
  }

  logger.info("Access request rejected", {
    requestId: req.id,
    schoolId: req.schoolId,
    schoolAdminId: req.schoolAdminId,
    decidedBy: params.decidedBy,
  });

  return updated;
}

/* -- Access code management (creator side) ---------------------- */

/**
 * List access codes for a school (for the creator to manage).
 * Returns the most recently created first.
 */
export async function listAccessCodes(
  schoolId: string,
): Promise<Array<SchoolAccessCode>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schoolAccessCodes)
    .where(eq(schoolAccessCodes.schoolId, schoolId))
    .orderBy(desc(schoolAccessCodes.createdAt));
  return rows;
}

/**
 * Deactivate an access code (revoke). The code can no longer be used.
 */
export async function deactivateAccessCode(
  codeId: string,
): Promise<SchoolAccessCode> {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(schoolAccessCodes)
    .where(eq(schoolAccessCodes.id, codeId))
    .limit(1);
  if (!existing) throw AppError.notFound("Code introuvable");

  const [updated] = await db
    .update(schoolAccessCodes)
    .set({ isActive: false })
    .where(eq(schoolAccessCodes.id, codeId))
    .returning();

  if (!updated) {
    throw AppError.internal("Failed to deactivate access code");
  }

  logger.info("Access code deactivated", { codeId });

  return updated;
}

/* -- Cleanup helper (not exposed) ------------------------------- */

/**
 * Mark expired codes as inactive (housekeeping). Could be called by a cron.
 */
export async function deactivateExpiredCodes(): Promise<number> {
  const db = await getDb();
  const updated = await db
    .update(schoolAccessCodes)
    .set({ isActive: false })
    .where(
      and(
        eq(schoolAccessCodes.isActive, true),
        lt(schoolAccessCodes.expiresAt, new Date()),
      ),
    )
    .returning();
  return updated.length;
}
