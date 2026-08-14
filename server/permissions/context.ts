/**
 * §9.3 — Contextual authorization helpers.
 *
 * `permissions.ts` handles role-based RBAC. This file handles *contextual*
 * checks: "is this user a member of class X?", "is this user the parent of
 * student Y?", etc. These cannot be expressed as a static matrix.
 */

import { getDb } from "@/server/db";
import { users, schoolMembers, classMembers, parentStudentRelations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "@/lib/api-response";
import type { UserRole } from "@/types";

/**
 * Require that the current user has one of the allowed roles.
 * Throws AppError.unauthorized() if the role is not in the list.
 */
export function requireRole(
  userRole: UserRole | undefined,
  ...allowed: UserRole[]
): void {
  if (!userRole) {
    throw AppError.unauthenticated();
  }
  if (!allowed.includes(userRole)) {
    throw AppError.unauthorized(
      `This action requires one of: ${allowed.join(", ")}`,
    );
  }
}

/**
 * Returns true if the user is a member of the given school.
 */
export async function isSchoolMember(
  userId: string,
  schoolId: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: schoolMembers.id })
    .from(schoolMembers)
    .where(and(eq(schoolMembers.userId, userId), eq(schoolMembers.schoolId, schoolId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Returns the school member row if the user is a member, null otherwise.
 * Useful when we need the role/status in addition to the membership check.
 */
export async function getSchoolMember(
  userId: string,
  schoolId: string,
): Promise<typeof schoolMembers.$inferSelect | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schoolMembers)
    .where(and(eq(schoolMembers.userId, userId), eq(schoolMembers.schoolId, schoolId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns true if the user is a member of the given class.
 */
export async function isClassMember(
  userId: string,
  classId: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: classMembers.id })
    .from(classMembers)
    .where(and(eq(classMembers.userId, userId), eq(classMembers.classId, classId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Returns the class member row if the user is a member, null otherwise.
 */
export async function getClassMember(
  userId: string,
  classId: string,
): Promise<typeof classMembers.$inferSelect | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(classMembers)
    .where(and(eq(classMembers.userId, userId), eq(classMembers.classId, classId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns true if the parent is linked to the given student.
 */
export async function isParentOf(
  parentId: string,
  studentId: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: parentStudentRelations.id })
    .from(parentStudentRelations)
    .where(
      and(
        eq(parentStudentRelations.parentId, parentId),
        eq(parentStudentRelations.studentId, studentId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Returns true if the user is the teacher of the given class
 * (either head_teacher or a class_member with role 'teacher').
 */
export async function isClassTeacher(
  userId: string,
  classId: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: classMembers.id })
    .from(classMembers)
    .where(
      and(
        eq(classMembers.userId, userId),
        eq(classMembers.classId, classId),
        eq(classMembers.role, "teacher"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Fetch a user by clerkId and ensure they exist; throw otherwise.
 */
export async function requireUserByClerkId(clerkId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  const user = rows.at(0);
  if (!user) {
    throw AppError.notFound("User profile not found. Please complete onboarding.");
  }
  return user;
}
