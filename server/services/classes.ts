/**
 * §5.3 — Class service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 */

import { and, count, eq, ilike, inArray, or, SQL } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { getDb } from "@/server/db";
import {
  classes,
  classMembers,
  classSubjects,
  schools,
  schoolMembers,
  subjects,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type {
  CreateClassInput,
  UpdateClassInput,
  ListClassesQuery,
} from "@/server/validators/classes";
import type {
  Class,
  ClassMember,
  ClassSubject,
} from "@/server/db/schema/schools";
import type { Subject } from "@/server/db/schema/schools";
import type { User } from "@/server/db/schema/users";

/* ── Types ─────────────────────────────────────────────────── */

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateInviteCode = customAlphabet(alphabet, 8);

export type ClassWithRelations = Class & {
  school: { id: string; name: string; slug: string } | null;
  headTeacher: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl"
  > | null;
  studentsCount: number;
  teachersCount: number;
  subjectsCount: number;
};

export type ClassMemberWithUser = ClassMember & {
  user: Pick<
    User,
    "id" | "email" | "firstName" | "lastName" | "avatarUrl" | "role"
  >;
};

export type ClassSubjectWithRelations = ClassSubject & {
  subject: Subject;
  teacher: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl"
  > | null;
};

/* ── Mutations ─────────────────────────────────────────────── */

/**
 * Create a new class within a school. Auto-generates an 8-char invite code.
 */
export async function createClass(
  input: CreateClassInput,
  creatorUserId: string,
): Promise<Class> {
  const db = await getDb();

  // Verify school exists.
  const schoolRows = await db
    .select({ id: schools.id })
    .from(schools)
    .where(eq(schools.id, input.schoolId))
    .limit(1);
  if (schoolRows.length === 0) {
    throw AppError.notFound("School not found");
  }

  const [created] = await db
    .insert(classes)
    .values({
      schoolId: input.schoolId,
      name: input.name,
      level: input.level,
      series: input.series,
      academicYear: input.academicYear,
      headTeacherId: input.headTeacherId,
      inviteCode: input.inviteCode ?? generateInviteCode(),
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create class");

  // NOTE: The creator (school_admin) is NOT auto-added as a class member.
  // Teachers are added to a class either by accepting an invitation, by
  // being assigned as head teacher, or by joining via invite code.
  // The `creatorUserId` parameter is kept for audit-logging purposes only.
  void creatorUserId;

  return created;
}

export async function updateClass(
  id: string,
  input: UpdateClassInput,
): Promise<Class> {
  const db = await getDb();
  const [updated] = await db
    .update(classes)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.series !== undefined ? { series: input.series } : {}),
      ...(input.academicYear !== undefined
        ? { academicYear: input.academicYear }
        : {}),
      ...(input.headTeacherId !== undefined
        ? { headTeacherId: input.headTeacherId }
        : {}),
      ...(input.inviteCode !== undefined
        ? { inviteCode: input.inviteCode }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(classes.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Class not found");
  return updated;
}

/**
 * Archive a class by deleting it (no archive column on the table yet —
 * §5.3 mentions "archive de classe en fin d'année" so future phases will add
 * a status column. For now we delete and return void).
 */
export async function archiveClass(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(classes).where(eq(classes.id, id));
}

/**
 * Student / teacher / parent self-join via invite code.
 */
export async function joinClassByCode(
  code: string,
  userId: string,
  role: "admin" | "teacher" | "student" | "parent" | "staff" = "student",
): Promise<Class> {
  const db = await getDb();

  const classRows = await db
    .select()
    .from(classes)
    .where(eq(classes.inviteCode, code))
    .limit(1);
  const cls = classRows.at(0);
  if (!cls) {
    throw AppError.notFound("Invalid invite code");
  }

  // Idempotent: if already a member, just return the class.
  const existing = await db
    .select()
    .from(classMembers)
    .where(
      and(eq(classMembers.classId, cls.id), eq(classMembers.userId, userId)),
    )
    .limit(1);
  if (existing.length > 0) {
    return cls;
  }

  await db.insert(classMembers).values({
    classId: cls.id,
    userId,
    role,
  });

  return cls;
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getClassById(
  id: string,
): Promise<ClassWithRelations | null> {
  const db = await getDb();
  const rows = await db
    .select({
      cls: classes,
      school: {
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
      },
      headTeacher: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(classes)
    .leftJoin(schools, eq(schools.id, classes.schoolId))
    .leftJoin(users, eq(users.id, classes.headTeacherId))
    .where(eq(classes.id, id))
    .limit(1);

  const row = rows.at(0);
  if (!row) return null;

  const [studentsCount, teachersCount, subjectsCount] = await Promise.all([
    countMembersByRole(id, "student"),
    countMembersByRole(id, "teacher"),
    countSubjects(id),
  ]);

  return {
    ...row.cls,
    school: row.school?.id ? row.school : null,
    headTeacher: row.headTeacher?.id ? row.headTeacher : null,
    studentsCount,
    teachersCount,
    subjectsCount,
  };
}

export async function listClasses(
  filters: ListClassesQuery,
): Promise<{
  items: ClassWithRelations[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (filters.schoolId)
    conditions.push(eq(classes.schoolId, filters.schoolId) as never);
  if (filters.level) conditions.push(eq(classes.level, filters.level) as never);
  if (filters.series)
    conditions.push(eq(classes.series, filters.series) as never);
  if (filters.academicYear)
    conditions.push(eq(classes.academicYear, filters.academicYear) as never);

  // Filter by teacher (class_member role=teacher OR head_teacher_id).
  // We pre-fetch the class IDs where this user is a class_member with role=teacher.
  if (filters.teacherId) {
    const teacherClasses = await db
      .select({ classId: classMembers.classId })
      .from(classMembers)
      .where(
        and(
          eq(classMembers.userId, filters.teacherId),
          eq(classMembers.role, "teacher"),
        ),
      );
    const ids = teacherClasses.map((r) => r.classId);
    conditions.push(
      or(
        eq(classes.headTeacherId, filters.teacherId),
        ids.length > 0
          ? inArray(classes.id, ids)
          : eq(classes.id, "___none___"),
      ) as never,
    );
  }

  // Filter by student (must be a class_member with role=student).
  if (filters.studentId) {
    const studentClasses = await db
      .select({ classId: classMembers.classId })
      .from(classMembers)
      .where(
        and(
          eq(classMembers.userId, filters.studentId),
          eq(classMembers.role, "student"),
        ),
      );
    const ids = studentClasses.map((r) => r.classId);
    if (ids.length === 0) {
      return {
        items: [],
        total: 0,
        page: filters.page,
        pageSize: filters.pageSize,
      };
    }
    conditions.push(inArray(classes.id, ids) as never);
  }

  const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const baseQuery = db
    .select({
      cls: classes,
      school: {
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
      },
      headTeacher: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(classes)
    .leftJoin(schools, eq(schools.id, classes.schoolId))
    .leftJoin(users, eq(users.id, classes.headTeacherId))
    .$dynamic();

  const items = await baseQuery
    .where(finalWhere)
    .orderBy(classes.createdAt)
    .limit(filters.pageSize)
    .offset(offset);

  const totalRow = await db
    .select({ c: count() })
    .from(classes)
    .where(finalWhere);
  const total = Number(totalRow.at(0)?.c ?? 0);

  const enriched: ClassWithRelations[] = [];
  for (const r of items) {
    const [studentsCount, teachersCount, subjectsCount] = await Promise.all([
      countMembersByRole(r.cls.id, "student"),
      countMembersByRole(r.cls.id, "teacher"),
      countSubjects(r.cls.id),
    ]);
    enriched.push({
      ...r.cls,
      school: r.school?.id ? r.school : null,
      headTeacher: r.headTeacher?.id ? r.headTeacher : null,
      studentsCount,
      teachersCount,
      subjectsCount,
    });
  }

  return {
    items: enriched,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

async function countMembersByRole(
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

async function countSubjects(classId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(classSubjects)
    .where(eq(classSubjects.classId, classId));
  return Number(rows.at(0)?.c ?? 0);
}

export async function listClassMembers(
  classId: string,
): Promise<ClassMemberWithUser[]> {
  const db = await getDb();
  const rows = await db
    .select({
      member: classMembers,
      user: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        role: users.role,
      },
    })
    .from(classMembers)
    .innerJoin(users, eq(users.id, classMembers.userId))
    .where(eq(classMembers.classId, classId))
    .orderBy(classMembers.joinedAt);
  return rows.map((r) => ({ ...r.member, user: r.user }));
}

export async function removeMember(
  classId: string,
  userId: string,
): Promise<void> {
  const db = await getDb();
  await db
    .delete(classMembers)
    .where(
      and(eq(classMembers.classId, classId), eq(classMembers.userId, userId)),
    );
}

/* ── Helpers (re-exported for school pages) ─────────────────── */

/**
 * Returns the schoolId for a given class (used for context checks).
 */
export async function getSchoolIdForClass(
  classId: string,
): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ schoolId: classes.schoolId })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);
  return rows.at(0)?.schoolId ?? null;
}

/**
 * Returns true if the user is a member of the school owning the class.
 * Useful for permission checks (school_admin managing a class).
 */
export async function isUserInClassSchool(
  classId: string,
  userId: string,
): Promise<boolean> {
  const schoolId = await getSchoolIdForClass(classId);
  if (!schoolId) return false;
  const db = await getDb();
  const rows = await db
    .select({ id: schoolMembers.id })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Tiny Drizzle helper because Drizzle's `inArray` is exported from the root
 * (kept here to avoid polluting the import list above with a try/catch).
 */

/**
 * List subjects assigned to a class (with subject + teacher info).
 */
export async function listClassSubjects(
  classId: string,
): Promise<ClassSubjectWithRelations[]> {
  const db = await getDb();
  const rows = await db
    .select({
      cs: classSubjects,
      subject: subjects,
      teacher: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(classSubjects)
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .leftJoin(users, eq(users.id, classSubjects.teacherId))
    .where(eq(classSubjects.classId, classId))
    .orderBy(classSubjects.createdAt);

  return rows.map((r) => ({
    ...r.cs,
    subject: r.subject,
    teacher: r.teacher?.id ? r.teacher : null,
  }));
}

// Suppress unused-import warning.
void ilike;
