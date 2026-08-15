/**
 * §5.9 + §5.10 — Analytics service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Provides role-scoped aggregations for:
 *  - Students: progress, subject stats, quiz history, assignment history,
 *    activity timeline, streak calendar.
 *  - Teachers: overview, class stats, assignment stats, students needing
 *    attention.
 *  - Schools: overview, engagement, top contents, class comparison, usage.
 *  - Platform admins: overview, growth, role distribution, top schools,
 *    top contents.
 *
 * All numeric aggregates use Number() conversion because Drizzle returns
 * numbers as strings when using `count()` on SQLite.
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
  sum,
  asc,
} from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  assignments,
  assignmentItems,
  classes,
  classMembers,
  classSubjects,
  contents,
  favorites,
  grades,
  notifications,
  quizAnswers,
  quizQuestionOptions,
  quizQuestions,
  quizSessions,
  quizzes,
  schools,
  schoolMembers,
  subjects,
  submissions,
  subscriptions,
  userActivities,
  userGoals,
  userPoints,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";

/* --------------------------------------------------------------
 * Shared types
 * ------------------------------------------------------------- */

export interface TimelinePoint {
  date: string; // ISO date (yyyy-mm-dd)
  count: number;
}

export interface StreakDay {
  date: string; // ISO date (yyyy-mm-dd)
  active: boolean;
}

/* --------------------------------------------------------------
 * Student analytics
 * ------------------------------------------------------------- */

export type StudentProgress = {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  weeklyGoal: number;
  weeklyProgress: number;
  completedQuizzes: number;
  submittedAssignments: number;
  gradedAssignments: number;
  averageQuizScore: number; // percentage 0-100
  averageAssignmentScore: number; // percentage 0-100
};

export type StudentSubjectStat = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  averageScore: number; // percentage 0-100
  completionRate: number; // percentage 0-100
  submissionsCount: number;
  quizzesCount: number;
};

export type StudentQuizHistoryItem = {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  status: string;
  completedAt: Date | null;
};

export type StudentAssignmentHistoryItem = {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  status: string;
  score: number | null;
  points: number | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
};

/**
 * Compute the weekly progress (count of activities in the last 7 days).
 */
async function computeWeeklyProgress(studentId: string): Promise<number> {
  const db = await getDb();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const rows = await db
    .select({ c: count() })
    .from(userActivities)
    .where(
      and(
        eq(userActivities.userId, studentId),
        gte(userActivities.createdAt, since),
      ),
    );
  return Number(rows.at(0)?.c ?? 0);
}

export async function getStudentProgress(
  studentId: string,
): Promise<StudentProgress> {
  const db = await getDb();

  // XP / level
  const xpRows = await db
    .select()
    .from(userPoints)
    .where(eq(userPoints.userId, studentId))
    .limit(1);
  const xp = xpRows.at(0);

  // User streaks
  const userRows = await db
    .select({
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      weeklyGoal: users.weeklyGoal,
    })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  const user = userRows.at(0);
  if (!user) throw AppError.notFound("Student not found");

  // Quiz sessions: completed ones with maxScore > 0
  const quizRows = await db
    .select({
      totalScore: quizSessions.totalScore,
      maxScore: quizSessions.maxScore,
      status: quizSessions.status,
    })
    .from(quizSessions)
    .where(
      and(
        eq(quizSessions.userId, studentId),
        eq(quizSessions.status, "completed"),
      ),
    );
  const completedQuizzes = quizRows.length;
  const quizScoreSum = quizRows.reduce(
    (acc, r) => acc + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0),
    0,
  );
  const averageQuizScore =
    completedQuizzes > 0 ? quizScoreSum / completedQuizzes : 0;

  // Submissions
  const subRows = await db
    .select({
      status: submissions.status,
      score: submissions.score,
      points: assignments.points,
    })
    .from(submissions)
    .leftJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.studentId, studentId));
  const submittedAssignments = subRows.filter(
    (r) => r.status !== "not_started",
  ).length;
  const graded = subRows.filter(
    (r) => r.status === "graded" || r.status === "returned",
  );
  const gradedAssignments = graded.length;
  const assignmentScoreSum = graded.reduce((acc, r) => {
    if (r.score == null || r.points == null || r.points === 0) return acc;
    const s = Number(r.score);
    if (Number.isNaN(s)) return acc;
    return acc + (s / r.points) * 100;
  }, 0);
  const averageAssignmentScore =
    gradedAssignments > 0 ? assignmentScoreSum / gradedAssignments : 0;

  const weeklyProgress = await computeWeeklyProgress(studentId);

  return {
    totalXp: xp?.totalXp ?? 0,
    level: xp?.level ?? 1,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    weeklyGoal: user.weeklyGoal,
    weeklyProgress,
    completedQuizzes,
    submittedAssignments,
    gradedAssignments,
    averageQuizScore: Math.round(averageQuizScore * 10) / 10,
    averageAssignmentScore: Math.round(averageAssignmentScore * 10) / 10,
  };
}

export async function getStudentSubjectStats(
  studentId: string,
): Promise<StudentSubjectStat[]> {
  const db = await getDb();

  // Quiz sessions aggregated per subject via quiz → subject join.
  const quizBySubject = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      totalScore: quizSessions.totalScore,
      maxScore: quizSessions.maxScore,
    })
    .from(quizSessions)
    .innerJoin(quizzes, eq(quizzes.id, quizSessions.quizId))
    .leftJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .where(
      and(
        eq(quizSessions.userId, studentId),
        eq(quizSessions.status, "completed"),
        isNotNull(quizzes.subjectId),
      ),
    );

  // Submissions aggregated per subject via assignment → subject join.
  const subBySubject = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      score: submissions.score,
      points: assignments.points,
      status: submissions.status,
    })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
    .where(
      and(
        eq(submissions.studentId, studentId),
        isNotNull(assignments.subjectId),
      ),
    );

  // Merge maps keyed by subjectId.
  const map = new Map<
    string,
    {
      name: string;
      code: string | null;
      quizSum: number;
      quizCount: number;
      subSum: number;
      subCount: number;
      subCompleted: number;
    }
  >();

  for (const r of quizBySubject) {
    if (!r.subjectId) continue;
    const entry = map.get(r.subjectId) ?? {
      name: r.subjectName!,
      code: r.subjectCode,
      quizSum: 0,
      quizCount: 0,
      subSum: 0,
      subCount: 0,
      subCompleted: 0,
    };
    entry.quizCount += 1;
    if (r.maxScore > 0) {
      entry.quizSum += (r.totalScore / r.maxScore) * 100;
    }
    map.set(r.subjectId, entry);
  }

  for (const r of subBySubject) {
    if (!r.subjectId) continue;
    const entry = map.get(r.subjectId) ?? {
      name: r.subjectName!,
      code: r.subjectCode,
      quizSum: 0,
      quizCount: 0,
      subSum: 0,
      subCount: 0,
      subCompleted: 0,
    };
    entry.subCount += 1;
    if (r.status !== "not_started") entry.subCompleted += 1;
    if (r.score != null && r.points != null && r.points > 0) {
      const s = Number(r.score);
      if (!Number.isNaN(s)) entry.subSum += (s / r.points) * 100;
    }
    map.set(r.subjectId, entry);
  }

  const results: StudentSubjectStat[] = [];
  for (const [subjectId, entry] of map) {
    const averageScore =
      entry.quizCount + entry.subCompleted > 0
        ? (entry.quizSum + entry.subSum) /
          (entry.quizCount + entry.subCompleted)
        : 0;
    const completionRate =
      entry.subCount + entry.quizCount > 0
        ? ((entry.subCompleted + entry.quizCount) /
            (entry.subCount + entry.quizCount)) *
          100
        : 0;
    results.push({
      subjectId,
      subjectName: entry.name,
      subjectCode: entry.code,
      averageScore: Math.round(averageScore * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
      submissionsCount: entry.subCount,
      quizzesCount: entry.quizCount,
    });
  }

  return results.sort((a, b) => b.averageScore - a.averageScore);
}

export async function getStudentQuizHistory(
  studentId: string,
  limit = 10,
): Promise<StudentQuizHistoryItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      sessionId: quizSessions.id,
      quizId: quizzes.id,
      quizTitle: quizzes.title,
      totalScore: quizSessions.totalScore,
      maxScore: quizSessions.maxScore,
      status: quizSessions.status,
      completedAt: quizSessions.completedAt,
    })
    .from(quizSessions)
    .innerJoin(quizzes, eq(quizzes.id, quizSessions.quizId))
    .where(eq(quizSessions.userId, studentId))
    .orderBy(desc(quizSessions.completedAt))
    .limit(limit);

  return rows.map((r) => ({
    sessionId: r.sessionId,
    quizId: r.quizId,
    quizTitle: r.quizTitle,
    totalScore: r.totalScore,
    maxScore: r.maxScore,
    percentage:
      r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 1000) / 10 : 0,
    status: r.status,
    completedAt: r.completedAt,
  }));
}

export async function getStudentAssignmentHistory(
  studentId: string,
  limit = 10,
): Promise<StudentAssignmentHistoryItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      submissionId: submissions.id,
      assignmentId: assignments.id,
      assignmentTitle: assignments.title,
      status: submissions.status,
      score: submissions.score,
      points: assignments.points,
      submittedAt: submissions.submittedAt,
      gradedAt: submissions.gradedAt,
    })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.studentId, studentId))
    .orderBy(desc(submissions.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    submissionId: r.submissionId,
    assignmentId: r.assignmentId,
    assignmentTitle: r.assignmentTitle,
    status: r.status,
    score: r.score == null ? null : Number(r.score),
    points: r.points,
    submittedAt: r.submittedAt,
    gradedAt: r.gradedAt,
  }));
}

export async function getStudentActivityTimeline(
  studentId: string,
  days = 30,
): Promise<TimelinePoint[]> {
  const db = await getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      createdAt: userActivities.createdAt,
    })
    .from(userActivities)
    .where(
      and(
        eq(userActivities.userId, studentId),
        gte(userActivities.createdAt, since),
      ),
    );

  // Bucket by day in JS (works for both SQLite + PG timestamps).
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(formatDayKey(d), 0);
  }
  for (const row of rows) {
    const key = formatDayKey(row.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, c]) => ({
    date,
    count: c,
  }));
}

export async function getStudentStreakCalendar(
  studentId: string,
  days = 84,
): Promise<StreakDay[]> {
  const db = await getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ createdAt: userActivities.createdAt })
    .from(userActivities)
    .where(
      and(
        eq(userActivities.userId, studentId),
        gte(userActivities.createdAt, since),
      ),
    );

  const activeDays = new Set<string>();
  for (const row of rows) {
    activeDays.add(formatDayKey(row.createdAt));
  }

  const result: StreakDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = formatDayKey(d);
    result.push({ date: key, active: activeDays.has(key) });
  }
  return result;
}

/* --------------------------------------------------------------
 * Teacher analytics
 * ------------------------------------------------------------- */

export type TeacherOverview = {
  classesCount: number;
  studentsCount: number;
  assignmentsCount: number;
  quizzesCount: number;
  averageClassPerformance: number; // 0-100
};

export type TeacherClassStat = {
  classId: string;
  className: string;
  level: string | null;
  series: string | null;
  studentsCount: number;
  averageScore: number; // 0-100
  completionRate: number; // 0-100
};

export type TeacherAssignmentStat = {
  assignmentId: string;
  title: string;
  submissionsCount: number;
  gradedCount: number;
  submissionRate: number; // 0-100
  averageScore: number; // 0-100
};

export type TeacherStudentNeedingAttention = {
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatarUrl: string | null;
  averageScore: number; // 0-100
  lateCount: number;
  missingCount: number;
};

export async function getTeacherOverview(
  teacherId: string,
): Promise<TeacherOverview> {
  const db = await getDb();

  // Classes where the teacher is a member with role=teacher.
  const teacherClasses = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(
      and(eq(classMembers.userId, teacherId), eq(classMembers.role, "teacher")),
    );
  const classIds = teacherClasses.map((r) => r.classId);
  const classesCount = classIds.length;

  // Students across those classes.
  let studentsCount = 0;
  if (classIds.length > 0) {
    const studentRows = await db
      .select({ c: count() })
      .from(classMembers)
      .where(
        and(
          inArray(classMembers.classId, classIds),
          eq(classMembers.role, "student"),
        ),
      );
    studentsCount = Number(studentRows.at(0)?.c ?? 0);
  }

  // Assignments authored by the teacher.
  const assignmentRows = await db
    .select({ c: count() })
    .from(assignments)
    .where(eq(assignments.teacherId, teacherId));
  const assignmentsCount = Number(assignmentRows.at(0)?.c ?? 0);

  // Quizzes authored by the teacher.
  const quizRows = await db
    .select({ c: count() })
    .from(quizzes)
    .where(eq(quizzes.createdBy, teacherId));
  const quizzesCount = Number(quizRows.at(0)?.c ?? 0);

  // Average class performance: across all completed quiz sessions + graded
  // submissions for students in the teacher's classes.
  let averageClassPerformance = 0;
  if (classIds.length > 0) {
    const studentRows = await db
      .select({ userId: classMembers.userId })
      .from(classMembers)
      .where(
        and(
          inArray(classMembers.classId, classIds),
          eq(classMembers.role, "student"),
        ),
      );
    const studentIds = studentRows.map((r) => r.userId);

    if (studentIds.length > 0) {
      const sessionRows = await db
        .select({
          totalScore: quizSessions.totalScore,
          maxScore: quizSessions.maxScore,
        })
        .from(quizSessions)
        .where(
          and(
            inArray(quizSessions.userId, studentIds),
            eq(quizSessions.status, "completed"),
          ),
        );
      const sumPct = sessionRows.reduce(
        (acc, r) =>
          acc + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0),
        0,
      );
      averageClassPerformance =
        sessionRows.length > 0 ? sumPct / sessionRows.length : 0;
    }
  }

  return {
    classesCount,
    studentsCount,
    assignmentsCount,
    quizzesCount,
    averageClassPerformance: Math.round(averageClassPerformance * 10) / 10,
  };
}

export async function getTeacherClassStats(
  teacherId: string,
): Promise<TeacherClassStat[]> {
  const db = await getDb();
  const teacherClasses = await db
    .select({
      classId: classMembers.classId,
    })
    .from(classMembers)
    .where(
      and(eq(classMembers.userId, teacherId), eq(classMembers.role, "teacher")),
    );
  const classIds = teacherClasses.map((r) => r.classId);
  if (classIds.length === 0) return [];

  const classInfos = await db
    .select({
      id: classes.id,
      name: classes.name,
      level: classes.level,
      series: classes.series,
    })
    .from(classes)
    .where(inArray(classes.id, classIds));

  const stats: TeacherClassStat[] = [];
  for (const cls of classInfos) {
    // Students count.
    const studentRows = await db
      .select({ userId: classMembers.userId })
      .from(classMembers)
      .where(
        and(eq(classMembers.classId, cls.id), eq(classMembers.role, "student")),
      );
    const studentIds = studentRows.map((r) => r.userId);
    const studentsCount = studentIds.length;
    if (studentsCount === 0) {
      stats.push({
        classId: cls.id,
        className: cls.name,
        level: cls.level,
        series: cls.series,
        studentsCount: 0,
        averageScore: 0,
        completionRate: 0,
      });
      continue;
    }

    // Quiz performance.
    const sessionRows = await db
      .select({
        totalScore: quizSessions.totalScore,
        maxScore: quizSessions.maxScore,
      })
      .from(quizSessions)
      .where(
        and(
          inArray(quizSessions.userId, studentIds),
          eq(quizSessions.status, "completed"),
        ),
      );
    const sumPct = sessionRows.reduce(
      (acc, r) =>
        acc + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0),
      0,
    );
    const averageScore =
      sessionRows.length > 0 ? sumPct / sessionRows.length : 0;

    // Assignment completion: submissions submitted vs total assignments for this class.
    const assignmentRows = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.classId, cls.id),
          eq(assignments.status, "published"),
        ),
      );
    const assignmentIds = assignmentRows.map((r) => r.id);
    const expectedCount = assignmentIds.length * studentsCount;
    let submittedCount = 0;
    if (assignmentIds.length > 0) {
      const subRows = await db
        .select({ c: count() })
        .from(submissions)
        .where(
          and(
            inArray(submissions.assignmentId, assignmentIds),
            inArray(submissions.studentId, studentIds),
          ),
        );
      submittedCount = Number(subRows.at(0)?.c ?? 0);
    }
    const completionRate =
      expectedCount > 0 ? (submittedCount / expectedCount) * 100 : 0;

    stats.push({
      classId: cls.id,
      className: cls.name,
      level: cls.level,
      series: cls.series,
      studentsCount,
      averageScore: Math.round(averageScore * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
    });
  }

  return stats;
}

export async function getTeacherAssignmentStats(
  teacherId: string,
): Promise<TeacherAssignmentStat[]> {
  const db = await getDb();
  const teacherAssignments = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      points: assignments.points,
      classId: assignments.classId,
    })
    .from(assignments)
    .where(eq(assignments.teacherId, teacherId))
    .orderBy(desc(assignments.createdAt))
    .limit(20);
  if (teacherAssignments.length === 0) return [];

  const results: TeacherAssignmentStat[] = [];
  for (const a of teacherAssignments) {
    // Students in class
    const studentRows = await db
      .select({ userId: classMembers.userId })
      .from(classMembers)
      .where(
        and(
          eq(classMembers.classId, a.classId),
          eq(classMembers.role, "student"),
        ),
      );
    const studentIds = studentRows.map((r) => r.userId);
    const expected = studentIds.length;

    const subRows = await db
      .select({
        status: submissions.status,
        score: submissions.score,
      })
      .from(submissions)
      .where(eq(submissions.assignmentId, a.id));
    const submitted = subRows.filter((r) => r.status !== "not_started").length;
    const graded = subRows.filter(
      (r) => r.status === "graded" || r.status === "returned",
    );
    const gradedCount = graded.length;
    const sumPct = graded.reduce((acc, r) => {
      if (r.score == null || a.points == null || a.points === 0) return acc;
      const s = Number(r.score);
      if (Number.isNaN(s)) return acc;
      return acc + (s / a.points) * 100;
    }, 0);
    const averageScore = gradedCount > 0 ? sumPct / gradedCount : 0;

    results.push({
      assignmentId: a.id,
      title: a.title,
      submissionsCount: submitted,
      gradedCount,
      submissionRate:
        expected > 0 ? Math.round((submitted / expected) * 1000) / 10 : 0,
      averageScore: Math.round(averageScore * 10) / 10,
    });
  }
  return results;
}

export async function getTeacherStudentPerformance(
  teacherId: string,
): Promise<TeacherStudentNeedingAttention[]> {
  const db = await getDb();
  const teacherClasses = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(
      and(eq(classMembers.userId, teacherId), eq(classMembers.role, "teacher")),
    );
  const classIds = teacherClasses.map((r) => r.classId);
  if (classIds.length === 0) return [];

  const studentRows = await db
    .select({
      userId: classMembers.userId,
    })
    .from(classMembers)
    .where(
      and(
        inArray(classMembers.classId, classIds),
        eq(classMembers.role, "student"),
      ),
    );
  const studentIds = studentRows.map((r) => r.userId);
  if (studentIds.length === 0) return [];

  const userRows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, studentIds));

  const results: TeacherStudentNeedingAttention[] = [];
  for (const u of userRows) {
    // Quiz performance
    const sessionRows = await db
      .select({
        totalScore: quizSessions.totalScore,
        maxScore: quizSessions.maxScore,
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, u.id),
          eq(quizSessions.status, "completed"),
        ),
      );
    const sumPct = sessionRows.reduce(
      (acc, r) =>
        acc + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0),
      0,
    );
    const averageScore =
      sessionRows.length > 0 ? sumPct / sessionRows.length : 0;

    // Late / missing submissions for assignments of teacher's classes.
    const subRows = await db
      .select({ status: submissions.status })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .where(
        and(
          eq(submissions.studentId, u.id),
          inArray(assignments.classId, classIds),
        ),
      );
    const lateCount = subRows.filter((r) => r.status === "late").length;
    const missingCount = subRows.filter(
      (r) => r.status === "not_started",
    ).length;

    results.push({
      studentId: u.id,
      studentName:
        [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
      studentEmail: u.email,
      avatarUrl: u.avatarUrl,
      averageScore: Math.round(averageScore * 10) / 10,
      lateCount,
      missingCount,
    });
  }

  // Sort by average score asc (lowest first = needing most attention).
  return results.sort((a, b) => a.averageScore - b.averageScore).slice(0, 10);
}

/* --------------------------------------------------------------
 * School analytics
 * ------------------------------------------------------------- */

export type SchoolOverview = {
  teachersCount: number;
  studentsCount: number;
  classesCount: number;
  contentsCount: number;
  assignmentsCount: number;
  submissionsCount: number;
  quizSessionsCount: number;
};

export type SchoolTopContent = {
  contentId: string;
  title: string;
  type: string;
  viewsCount: number;
  downloadsCount: number;
  ratingAvg: number;
};

export type SchoolUsageStat = {
  assignmentsCreated: number;
  submissionsCount: number;
  quizSessionsCount: number;
  contentsPublished: number;
};

export async function getSchoolOverview(
  schoolId: string,
): Promise<SchoolOverview> {
  const db = await getDb();

  const teacherRows = await db
    .select({ c: count() })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.roleInSchool, "teacher"),
        eq(schoolMembers.status, "active"),
      ),
    );
  const studentRows = await db
    .select({ c: count() })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.roleInSchool, "student"),
        eq(schoolMembers.status, "active"),
      ),
    );
  const classRows = await db
    .select({ c: count() })
    .from(classes)
    .where(eq(classes.schoolId, schoolId));
  const contentRows = await db
    .select({ c: count() })
    .from(contents)
    .where(eq(contents.schoolId, schoolId));

  // Class IDs to compute assignment / submission counts.
  const classIdRows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.schoolId, schoolId));
  const classIds = classIdRows.map((r) => r.id);

  let assignmentsCount = 0;
  let submissionsCount = 0;
  if (classIds.length > 0) {
    const aRows = await db
      .select({ c: count() })
      .from(assignments)
      .where(inArray(assignments.classId, classIds));
    assignmentsCount = Number(aRows.at(0)?.c ?? 0);

    const assignmentIdsRows = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(inArray(assignments.classId, classIds));
    const assignmentIds = assignmentIdsRows.map((r) => r.id);
    if (assignmentIds.length > 0) {
      const sRows = await db
        .select({ c: count() })
        .from(submissions)
        .where(inArray(submissions.assignmentId, assignmentIds));
      submissionsCount = Number(sRows.at(0)?.c ?? 0);
    }
  }

  // Quiz sessions count: students in this school.
  const studentIdRows = await db
    .select({ userId: schoolMembers.userId })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.roleInSchool, "student"),
      ),
    );
  const studentIds = studentIdRows.map((r) => r.userId);
  let quizSessionsCount = 0;
  if (studentIds.length > 0) {
    const qRows = await db
      .select({ c: count() })
      .from(quizSessions)
      .where(inArray(quizSessions.userId, studentIds));
    quizSessionsCount = Number(qRows.at(0)?.c ?? 0);
  }

  return {
    teachersCount: Number(teacherRows.at(0)?.c ?? 0),
    studentsCount: Number(studentRows.at(0)?.c ?? 0),
    classesCount: Number(classRows.at(0)?.c ?? 0),
    contentsCount: Number(contentRows.at(0)?.c ?? 0),
    assignmentsCount,
    submissionsCount,
    quizSessionsCount,
  };
}

export async function getSchoolEngagement(
  schoolId: string,
  days = 30,
): Promise<TimelinePoint[]> {
  const db = await getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  // Active users = users in school_members who created at least one activity
  // since `since`. We count distinct (userId, day) tuples.
  const memberRows = await db
    .select({ userId: schoolMembers.userId })
    .from(schoolMembers)
    .where(eq(schoolMembers.schoolId, schoolId));
  const userIds = memberRows.map((r) => r.userId);
  if (userIds.length === 0) {
    return bucketEmpty(days, since);
  }

  const rows = await db
    .select({
      createdAt: userActivities.createdAt,
      userId: userActivities.userId,
    })
    .from(userActivities)
    .where(
      and(
        inArray(userActivities.userId, userIds),
        gte(userActivities.createdAt, since),
      ),
    );

  // Bucket distinct active users per day.
  const distinctPerDay = new Map<string, Set<string>>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    distinctPerDay.set(formatDayKey(d), new Set());
  }
  for (const row of rows) {
    const key = formatDayKey(row.createdAt);
    const set = distinctPerDay.get(key);
    if (set) set.add(row.userId);
  }
  return Array.from(distinctPerDay.entries()).map(([date, set]) => ({
    date,
    count: set.size,
  }));
}

export async function getSchoolTopContents(
  schoolId: string,
  limit = 5,
): Promise<SchoolTopContent[]> {
  const db = await getDb();
  const rows = await db
    .select({
      contentId: contents.id,
      title: contents.title,
      type: contents.type,
      viewsCount: contents.viewsCount,
      downloadsCount: contents.downloadsCount,
      ratingAvg: contents.ratingAvg,
    })
    .from(contents)
    .where(eq(contents.schoolId, schoolId))
    .orderBy(desc(contents.viewsCount))
    .limit(limit);
  return rows.map((r) => ({
    contentId: r.contentId,
    title: r.title,
    type: r.type,
    viewsCount: r.viewsCount,
    downloadsCount: r.downloadsCount,
    ratingAvg: r.ratingAvg == null ? 0 : Number(r.ratingAvg),
  }));
}

export async function getSchoolClassComparison(
  schoolId: string,
): Promise<TeacherClassStat[]> {
  const db = await getDb();
  const classRows = await db
    .select({
      id: classes.id,
      name: classes.name,
      level: classes.level,
      series: classes.series,
    })
    .from(classes)
    .where(eq(classes.schoolId, schoolId));
  if (classRows.length === 0) return [];

  const stats: TeacherClassStat[] = [];
  for (const cls of classRows) {
    const studentRows = await db
      .select({ userId: classMembers.userId })
      .from(classMembers)
      .where(
        and(eq(classMembers.classId, cls.id), eq(classMembers.role, "student")),
      );
    const studentIds = studentRows.map((r) => r.userId);
    if (studentIds.length === 0) {
      stats.push({
        classId: cls.id,
        className: cls.name,
        level: cls.level,
        series: cls.series,
        studentsCount: 0,
        averageScore: 0,
        completionRate: 0,
      });
      continue;
    }
    const sessionRows = await db
      .select({
        totalScore: quizSessions.totalScore,
        maxScore: quizSessions.maxScore,
      })
      .from(quizSessions)
      .where(
        and(
          inArray(quizSessions.userId, studentIds),
          eq(quizSessions.status, "completed"),
        ),
      );
    const sumPct = sessionRows.reduce(
      (acc, r) =>
        acc + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0),
      0,
    );
    const averageScore =
      sessionRows.length > 0 ? sumPct / sessionRows.length : 0;

    const assignmentRows = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.classId, cls.id),
          eq(assignments.status, "published"),
        ),
      );
    const assignmentIds = assignmentRows.map((r) => r.id);
    const expected = assignmentIds.length * studentIds.length;
    let submitted = 0;
    if (assignmentIds.length > 0) {
      const subRows = await db
        .select({ c: count() })
        .from(submissions)
        .where(
          and(
            inArray(submissions.assignmentId, assignmentIds),
            inArray(submissions.studentId, studentIds),
          ),
        );
      submitted = Number(subRows.at(0)?.c ?? 0);
    }
    const completionRate = expected > 0 ? (submitted / expected) * 100 : 0;

    stats.push({
      classId: cls.id,
      className: cls.name,
      level: cls.level,
      series: cls.series,
      studentsCount: studentIds.length,
      averageScore: Math.round(averageScore * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
    });
  }
  return stats;
}

export async function getSchoolUsageStats(
  schoolId: string,
): Promise<SchoolUsageStat> {
  const overview = await getSchoolOverview(schoolId);
  const db = await getDb();
  const publishedRows = await db
    .select({ c: count() })
    .from(contents)
    .where(
      and(
        eq(contents.schoolId, schoolId),
        eq(contents.publicationStatus, "published"),
      ),
    );
  return {
    assignmentsCreated: overview.assignmentsCount,
    submissionsCount: overview.submissionsCount,
    quizSessionsCount: overview.quizSessionsCount,
    contentsPublished: Number(publishedRows.at(0)?.c ?? 0),
  };
}

/* --------------------------------------------------------------
 * Platform analytics (admin)
 * ------------------------------------------------------------- */

export type PlatformOverview = {
  totalUsers: number;
  totalSchools: number;
  totalContents: number;
  activeSubscriptions: number;
  totalAssignments: number;
  totalQuizSessions: number;
};

export type PlatformTopSchool = {
  schoolId: string;
  name: string;
  city: string | null;
  membersCount: number;
  contentsCount: number;
};

export type PlatformTopContent = {
  contentId: string;
  title: string;
  type: string;
  viewsCount: number;
  downloadsCount: number;
  ratingAvg: number;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const db = await getDb();
  const userRows = await db.select({ c: count() }).from(users);
  const schoolRows = await db.select({ c: count() }).from(schools);
  const contentRows = await db.select({ c: count() }).from(contents);
  const subRows = await db
    .select({ c: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));
  const assignmentRows = await db.select({ c: count() }).from(assignments);
  const sessionRows = await db.select({ c: count() }).from(quizSessions);
  return {
    totalUsers: Number(userRows.at(0)?.c ?? 0),
    totalSchools: Number(schoolRows.at(0)?.c ?? 0),
    totalContents: Number(contentRows.at(0)?.c ?? 0),
    activeSubscriptions: Number(subRows.at(0)?.c ?? 0),
    totalAssignments: Number(assignmentRows.at(0)?.c ?? 0),
    totalQuizSessions: Number(sessionRows.at(0)?.c ?? 0),
  };
}

export async function getPlatformGrowth(days = 30): Promise<TimelinePoint[]> {
  const db = await getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(gte(users.createdAt, since));

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(formatDayKey(d), 0);
  }
  for (const row of rows) {
    const key = formatDayKey(row.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    count,
  }));
}

export type RoleDistributionEntry = {
  role: string;
  count: number;
};

export async function getPlatformRoleDistribution(): Promise<
  RoleDistributionEntry[]
> {
  const db = await getDb();
  const rows = await db
    .select({
      role: users.role,
      c: count(),
    })
    .from(users)
    .groupBy(users.role);
  return rows.map((r) => ({ role: r.role, count: Number(r.c) }));
}

export async function getPlatformTopSchools(
  limit = 5,
): Promise<PlatformTopSchool[]> {
  const db = await getDb();
  const rows = await db
    .select({
      schoolId: schools.id,
      name: schools.name,
      city: schools.city,
      membersCount: count(schoolMembers.id),
    })
    .from(schools)
    .leftJoin(schoolMembers, eq(schoolMembers.schoolId, schools.id))
    .groupBy(schools.id)
    .orderBy(desc(count(schoolMembers.id)))
    .limit(limit);
  const results: PlatformTopSchool[] = [];
  for (const r of rows) {
    const contentRows = await db
      .select({ c: count() })
      .from(contents)
      .where(eq(contents.schoolId, r.schoolId));
    results.push({
      schoolId: r.schoolId,
      name: r.name,
      city: r.city,
      membersCount: Number(r.membersCount ?? 0),
      contentsCount: Number(contentRows.at(0)?.c ?? 0),
    });
  }
  return results;
}

export async function getPlatformTopContents(
  limit = 5,
): Promise<PlatformTopContent[]> {
  const db = await getDb();
  const rows = await db
    .select({
      contentId: contents.id,
      title: contents.title,
      type: contents.type,
      viewsCount: contents.viewsCount,
      downloadsCount: contents.downloadsCount,
      ratingAvg: contents.ratingAvg,
    })
    .from(contents)
    .orderBy(desc(contents.viewsCount))
    .limit(limit);
  return rows.map((r) => ({
    contentId: r.contentId,
    title: r.title,
    type: r.type,
    viewsCount: r.viewsCount,
    downloadsCount: r.downloadsCount,
    ratingAvg: r.ratingAvg == null ? 0 : Number(r.ratingAvg),
  }));
}

/* --------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------- */

function formatDayKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function bucketEmpty(days: number, since: Date): TimelinePoint[] {
  const out: TimelinePoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    out.push({ date: formatDayKey(d), count: 0 });
  }
  return out;
}

// Suppress unused-import warnings (helpers kept for future raw queries).
void or;
void lte;
void asc;
void sum;
void notifications;
void favorites;
void grades;
void quizAnswers;
void quizQuestionOptions;
void quizQuestions;
void assignmentItems;
void classSubjects;
void userGoals;
void userPoints;
void sql;
