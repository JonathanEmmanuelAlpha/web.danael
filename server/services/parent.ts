/**
 * §5.14 — Parent service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced
 * by the server actions wrapping these functions, not here.
 *
 * A "parent" is linked to a "student" through the parent_student_relations
 * table. Linking uses the student's email address as the "invitation code"
 * (the email is unique in the users table).
 */

import { and, count, desc, eq, gte, inArray, or } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  assignments,
  attendance,
  classMembers,
  classes,
  grades,
  parentStudentRelations,
  submissions,
  subjects,
  userActivities,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type { LinkChildInput } from "@/server/validators/parent";
import type { User } from "@/server/db/schema/users";
import type { ParentStudentRelation } from "@/server/db/schema/schools";

/* ── Types ─────────────────────────────────────────────────── */

export type { ParentStudentRelation };

export type ChildSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  level: string | null;
  series: string | null;
  currentStreak: number;
  weeklyGoal: number;
  weeklyProgress: number;
  className: string | null;
  classId: string | null;
};

export type ChildGradeRow = {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  score: number;
  maxScore: number;
  period: string;
  comment: string | null;
  gradedAt: Date | null;
};

export type ChildGradesSummary = {
  averageScore: number;
  averageMax: number;
  averagePercent: number;
  subjectAverages: Array<{
    subjectId: string;
    subjectName: string;
    averageScore: number;
    averageMax: number;
    averagePercent: number;
    count: number;
  }>;
  recent: ChildGradeRow[];
};

export type ChildAttendanceSummary = {
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  totalCount: number;
  attendanceRate: number;
  recentAbsences: Array<{
    id: string;
    date: Date;
    status: string;
    reason: string | null;
    className: string | null;
  }>;
};

export type ChildAssignmentItem = {
  assignmentId: string;
  title: string;
  dueAt: Date | null;
  status: string;
  score: string | null;
  points: number | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
  subjectName: string | null;
};

export type ChildAssignmentsSummary = {
  upcoming: ChildAssignmentItem[];
  recent: ChildAssignmentItem[];
};

export type ChildTimelineItem = {
  id: string;
  activityType: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type ChildOverview = {
  summary: ChildSummary;
  grades: ChildGradesSummary;
  attendance: ChildAttendanceSummary;
  assignments: ChildAssignmentsSummary;
  timeline: ChildTimelineItem[];
};

/* ── Mutations ─────────────────────────────────────────────── */

/**
 * Link a parent to a student by the student's email address.
 * Validates that the student exists, has role "student", and isn't
 * already linked to this parent.
 */
export async function linkChild(
  parentId: string,
  input: LinkChildInput,
): Promise<ParentStudentRelation> {
  const db = await getDb();

  const studentRows = await db
    .select()
    .from(users)
    .where(eq(users.email, input.studentEmail))
    .limit(1);
  const student = studentRows.at(0);
  if (!student) {
    throw AppError.notFound("Aucun élève trouvé avec cet e-mail");
  }
  if (student.id === parentId) {
    throw AppError.validation("Vous ne pouvez pas vous lier vous-même");
  }
  if (student.role !== "student") {
    throw AppError.validation(
      "Le compte associé à cet e-mail n'est pas un compte élève",
    );
  }

  // Check existing relation (idempotent success).
  const existing = await db
    .select()
    .from(parentStudentRelations)
    .where(
      and(
        eq(parentStudentRelations.parentId, parentId),
        eq(parentStudentRelations.studentId, student.id),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return existing[0];
  }

  const [created] = await db
    .insert(parentStudentRelations)
    .values({
      parentId,
      studentId: student.id,
      relationship: input.relationship,
    })
    .returning();
  if (!created) {
    throw AppError.internal("Failed to link child");
  }
  return created;
}

/**
 * Remove the parent↔student relation. Caller is responsible for consent.
 */
export async function unlinkChild(
  parentId: string,
  studentId: string,
): Promise<{ removed: boolean }> {
  const db = await getDb();
  await db
    .delete(parentStudentRelations)
    .where(
      and(
        eq(parentStudentRelations.parentId, parentId),
        eq(parentStudentRelations.studentId, studentId),
      ),
    );
  return { removed: true };
}

/* ── Queries ───────────────────────────────────────────────── */

/**
 * List all students linked to a parent, enriched with basic stats.
 */
export async function listChildren(parentId: string): Promise<ChildSummary[]> {
  const db = await getDb();

  const relations = await db
    .select({
      relation: parentStudentRelations,
      student: users,
    })
    .from(parentStudentRelations)
    .innerJoin(users, eq(users.id, parentStudentRelations.studentId))
    .where(eq(parentStudentRelations.parentId, parentId))
    .orderBy(desc(parentStudentRelations.createdAt));

  if (relations.length === 0) return [];

  const studentIds = relations.map((r) => r.student.id);

  // Weekly progress (activities in last 7 days).
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const activityRows = await db
    .select({ userId: userActivities.userId, c: count() })
    .from(userActivities)
    .where(
      and(
        inArray(userActivities.userId, studentIds),
        gte(userActivities.createdAt, since),
      ),
    )
    .groupBy(userActivities.userId);
  const activityMap = new Map(activityRows.map((r) => [r.userId, Number(r.c)]));

  // Current class membership (student role) — take the latest joined class.
  const classRows = await db
    .select({
      userId: classMembers.userId,
      classId: classes.id,
      className: classes.name,
      joinedAt: classMembers.joinedAt,
    })
    .from(classMembers)
    .innerJoin(classes, eq(classes.id, classMembers.classId))
    .where(
      and(
        inArray(classMembers.userId, studentIds),
        eq(classMembers.role, "student"),
      ),
    )
    .orderBy(desc(classMembers.joinedAt));
  const classMap = new Map<string, { classId: string; className: string }>();
  for (const row of classRows) {
    if (!classMap.has(row.userId)) {
      classMap.set(row.userId, { classId: row.classId, className: row.className });
    }
  }

  return relations.map(({ student }) => {
    const cls = classMap.get(student.id);
    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      avatarUrl: student.avatarUrl,
      level: student.level,
      series: student.series,
      currentStreak: student.currentStreak,
      weeklyGoal: student.weeklyGoal,
      weeklyProgress: activityMap.get(student.id) ?? 0,
      className: cls?.className ?? null,
      classId: cls?.classId ?? null,
    };
  });
}

/**
 * Return the parent-facing summary for a single child.
 */
export async function getChildSummary(
  studentId: string,
): Promise<ChildSummary | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  const student = rows.at(0);
  if (!student) return null;

  // Weekly progress.
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const activityRows = await db
    .select({ c: count() })
    .from(userActivities)
    .where(
      and(
        eq(userActivities.userId, studentId),
        gte(userActivities.createdAt, since),
      ),
    );
  const weeklyProgress = Number(activityRows.at(0)?.c ?? 0);

  // Latest class.
  const classRows = await db
    .select({ classId: classes.id, className: classes.name })
    .from(classMembers)
    .innerJoin(classes, eq(classes.id, classMembers.classId))
    .where(
      and(eq(classMembers.userId, studentId), eq(classMembers.role, "student")),
    )
    .orderBy(desc(classMembers.joinedAt))
    .limit(1);
  const cls = classRows.at(0);

  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    avatarUrl: student.avatarUrl,
    level: student.level,
    series: student.series,
    currentStreak: student.currentStreak,
    weeklyGoal: student.weeklyGoal,
    weeklyProgress,
    className: cls?.className ?? null,
    classId: cls?.classId ?? null,
  };
}

/**
 * Grades by subject for a child, plus recent grades & subject averages.
 */
export async function getChildGrades(
  studentId: string,
): Promise<ChildGradesSummary> {
  const db = await getDb();

  const rows = await db
    .select({
      grade: grades,
      subjectName: subjects.name,
      subjectCode: subjects.code,
    })
    .from(grades)
    .leftJoin(subjects, eq(subjects.id, grades.subjectId))
    .where(eq(grades.studentId, studentId))
    .orderBy(desc(grades.createdAt));

  const mapped: ChildGradeRow[] = rows.map((r) => ({
    id: r.grade.id,
    subjectId: r.grade.subjectId,
    subjectName: r.subjectName,
    subjectCode: r.subjectCode,
    score: Number(r.grade.score),
    maxScore: Number(r.grade.maxScore),
    period: r.grade.period,
    comment: r.grade.comment,
    gradedAt: r.grade.updatedAt,
  }));

  const bySubject = new Map<
    string,
    {
      subjectId: string;
      subjectName: string;
      sumScore: number;
      sumMax: number;
      count: number;
    }
  >();
  let totalScore = 0;
  let totalMax = 0;
  for (const g of mapped) {
    const sid = g.subjectId ?? "—";
    const name = g.subjectName ?? "—";
    const entry =
      bySubject.get(sid) ??
      { subjectId: sid, subjectName: name, sumScore: 0, sumMax: 0, count: 0 };
    entry.sumScore += g.score;
    entry.sumMax += g.maxScore;
    entry.count += 1;
    bySubject.set(sid, entry);
    totalScore += g.score;
    totalMax += g.maxScore;
  }

  const subjectAverages = Array.from(bySubject.values()).map((e) => ({
    subjectId: e.subjectId,
    subjectName: e.subjectName,
    averageScore: e.count > 0 ? e.sumScore / e.count : 0,
    averageMax: e.count > 0 ? e.sumMax / e.count : 0,
    averagePercent:
      e.sumMax > 0 ? Math.round((e.sumScore / e.sumMax) * 1000) / 10 : 0,
    count: e.count,
  }));

  return {
    averageScore: mapped.length > 0 ? totalScore / mapped.length : 0,
    averageMax: mapped.length > 0 ? totalMax / mapped.length : 0,
    averagePercent:
      totalMax > 0 ? Math.round((totalScore / totalMax) * 1000) / 10 : 0,
    subjectAverages,
    recent: mapped.slice(0, 8),
  };
}

/**
 * Attendance summary for a child.
 */
export async function getChildAttendance(
  studentId: string,
): Promise<ChildAttendanceSummary> {
  const db = await getDb();

  const rows = await db
    .select({
      id: attendance.id,
      date: attendance.date,
      status: attendance.status,
      reason: attendance.reason,
      className: classes.name,
    })
    .from(attendance)
    .innerJoin(classes, eq(classes.id, attendance.classId))
    .where(eq(attendance.studentId, studentId))
    .orderBy(desc(attendance.date));

  const present = rows.filter((r) => r.status === "present").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const late = rows.filter((r) => r.status === "late").length;
  const excused = rows.filter((r) => r.status === "excused").length;
  const total = rows.length;
  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 100;

  return {
    presentCount: present,
    absentCount: absent,
    lateCount: late,
    excusedCount: excused,
    totalCount: total,
    attendanceRate: rate,
    recentAbsences: rows
      .filter((r) => r.status !== "present")
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        reason: r.reason,
        className: r.className,
      })),
  };
}

/**
 * Upcoming + recent assignments for a child.
 */
export async function getChildAssignments(
  studentId: string,
): Promise<ChildAssignmentsSummary> {
  const db = await getDb();

  // Find the student's class memberships.
  const memberships = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(
      and(eq(classMembers.userId, studentId), eq(classMembers.role, "student")),
    );
  const classIds = memberships.map((m) => m.classId);
  if (classIds.length === 0) {
    return { upcoming: [], recent: [] };
  }

  const rows = await db
    .select({
      assignmentId: assignments.id,
      title: assignments.title,
      dueAt: assignments.dueAt,
      points: assignments.points,
      status: submissions.status,
      score: submissions.score,
      submittedAt: submissions.submittedAt,
      gradedAt: submissions.gradedAt,
      subjectName: subjects.name,
    })
    .from(assignments)
    .leftJoin(
      submissions,
      and(
        eq(submissions.assignmentId, assignments.id),
        eq(submissions.studentId, studentId),
      ),
    )
    .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
    .where(
      and(
        inArray(assignments.classId, classIds),
        or(
          eq(assignments.status, "published"),
          eq(assignments.status, "closed"),
        ),
      ),
    )
    .orderBy(desc(assignments.dueAt));

  const now = new Date();
  const mapped: ChildAssignmentItem[] = rows.map((r) => ({
    assignmentId: r.assignmentId,
    title: r.title,
    dueAt: r.dueAt,
    status: r.status ?? "not_started",
    score: r.score,
    points: r.points,
    submittedAt: r.submittedAt,
    gradedAt: r.gradedAt,
    subjectName: r.subjectName,
  }));

  const upcoming = mapped
    .filter((a) => a.dueAt && a.dueAt >= now && a.status === "not_started")
    .slice(0, 6);
  const recent = mapped
    .filter((a) => a.status !== "not_started")
    .slice(0, 6);

  return { upcoming, recent };
}

/**
 * Recent activity timeline for a child.
 */
export async function getChildProgressTimeline(
  studentId: string,
  limit = 20,
): Promise<ChildTimelineItem[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userActivities)
    .where(eq(userActivities.userId, studentId))
    .orderBy(desc(userActivities.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    activityType: r.activityType,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: r.metadata,
    createdAt: r.createdAt,
  }));
}

/**
 * Combined overview (used by the child detail page header).
 */
export async function getChildOverview(
  studentId: string,
): Promise<ChildOverview> {
  const summary = await getChildSummary(studentId);
  if (!summary) throw AppError.notFound("Student not found");

  const [grades, attendance, assignments, timeline] = await Promise.all([
    getChildGrades(studentId),
    getChildAttendance(studentId),
    getChildAssignments(studentId),
    getChildProgressTimeline(studentId, 10),
  ]);

  return { summary, grades, attendance, assignments, timeline };
}
