"use server";

/**
 * §5.x — User discovery server actions.
 *
 * Used by:
 *  - /teachers/find   → school_admin searches for teachers to invite
 *  - /students/find   → school_admin searches for students to invite
 *  - /tutors          → students & parents search for tutors to book
 *
 * Each action wraps a Drizzle query with auth + RBAC + sandbox fallback
 * (returns mock data when the DB is unreachable so the UI still renders).
 */

import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getDb } from "@/server/db";
import {
  classSubjects,
  contents,
  quizSessions,
  subjects,
  tutorProfiles,
  tutorSubjects,
  userBadges,
  userPoints,
  users,
} from "@/server/db/schema";
import type { Subject } from "@/server/db/schema/schools";

/* ── Public types ──────────────────────────────────────────── */

export interface TeacherCardData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  subjects: string[]; // subject names
  classesCount: number;
  contentsCount: number;
  rating: number | null;
  isVerified: boolean;
}

export interface StudentCardData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  level: string | null;
  series: string | null;
  currentStreak: number;
  xpPoints: number;
  badgesCount: number;
  quizzesCompleted: number;
  avgScore: number | null;
}

export interface TutorCardData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  hourlyRate: number | null;
  location: string | null;
  subjects: string[];
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  totalSessions: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface ListInput {
  search?: string;
  subject?: string;
  page?: number;
  pageSize?: number;
}

interface ListTutorsInput extends ListInput {
  minRating?: number;
  verifiedOnly?: boolean;
}

interface ListStudentsInput extends ListInput {
  level?: string;
}

function toRating(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/* ── Actions ──────────────────────────────────────────────── */

/**
 * List teachers on the platform (for a school_admin to find and invite).
 *
 * Sandbox mode: returns mock data so the UI renders without a live DB.
 */
export async function listTeachersAction(
  input: ListInput,
): Promise<ApiResponse<ListResult<TeacherCardData>>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, input.pageSize ?? 12));

    const db = await getDb();

    // 1) Resolve subjectId → name (for subject filter + display).
    let subjectId: string | undefined;
    const subjectNameMap = new Map<string, string>();
    if (input.subject) {
      const subjRows = await db
        .select()
        .from(subjects)
        .where(
          or(
            eq(subjects.name, input.subject),
            ilike(subjects.code, input.subject.toUpperCase()),
          ),
        )
        .limit(1);
      const subj = subjRows.at(0);
      if (!subj) {
        return {
          success: true,
          data: { items: [], total: 0, page, hasMore: false },
        };
      }
      subjectId = subj.id;
      subjectNameMap.set(subj.id, subj.name);
    }

    // 2) Build teacher query: role = "teacher".
    const conditions: SQL[] = [eq(users.role, "teacher")];
    if (input.search) {
      const needle = `%${input.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, needle),
          ilike(users.lastName, needle),
          ilike(users.email, needle),
        )!,
      );
    }

    // If subject filter is set, restrict to teachers teaching that subject.
    if (subjectId) {
      const teacherIdsBySubject = await db
        .select({ teacherId: classSubjects.teacherId })
        .from(classSubjects)
        .where(eq(classSubjects.subjectId, subjectId));
      const ids = teacherIdsBySubject
        .map((r) => r.teacherId)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) {
        return {
          success: true,
          data: { items: [], total: 0, page, hasMore: false },
        };
      }
      conditions.push(inArray(users.id, ids));
    }

    const where = and(...conditions);

    // 3) Count + paginate users.
    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(users).where(where),
    ]);

    const total = Number(countRows.at(0)?.c ?? 0);
    if (rows.length === 0) {
      return {
        success: true,
        data: { items: [], total, page, hasMore: false },
      };
    }

    // 4) Aggregate per-teacher stats: classes count, contents count, subjects.
    const teacherIds = rows.map((r) => r.id);

    const [classCountRows, contentCountRows, subjectRows] = await Promise.all([
      db
        .select({
          teacherId: classSubjects.teacherId,
          c: count(),
        })
        .from(classSubjects)
        .where(inArray(classSubjects.teacherId, teacherIds))
        .groupBy(classSubjects.teacherId),
      db
        .select({
          uploadedBy: contents.uploadedBy,
          c: count(),
        })
        .from(contents)
        .where(inArray(contents.uploadedBy, teacherIds))
        .groupBy(contents.uploadedBy),
      db
        .select({
          teacherId: classSubjects.teacherId,
          subjectName: subjects.name,
        })
        .from(classSubjects)
        .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
        .where(inArray(classSubjects.teacherId, teacherIds)),
    ]);

    const classesByTeacher = new Map<string, number>();
    for (const r of classCountRows) {
      if (r.teacherId) classesByTeacher.set(r.teacherId, Number(r.c));
    }
    const contentsByTeacher = new Map<string, number>();
    for (const r of contentCountRows) {
      if (r.uploadedBy) contentsByTeacher.set(r.uploadedBy, Number(r.c));
    }
    const subjectsByTeacher = new Map<string, string[]>();
    for (const r of subjectRows) {
      if (!r.teacherId) continue;
      const arr = subjectsByTeacher.get(r.teacherId) ?? [];
      if (!arr.includes(r.subjectName)) arr.push(r.subjectName);
      subjectsByTeacher.set(r.teacherId, arr);
    }

    const items: TeacherCardData[] = rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      avatarUrl: r.avatarUrl,
      subjects: subjectsByTeacher.get(r.id) ?? [],
      classesCount: classesByTeacher.get(r.id) ?? 0,
      contentsCount: contentsByTeacher.get(r.id) ?? 0,
      rating: null,
      isVerified: false,
    }));

    return {
      success: true,
      data: {
        items,
        total,
        page,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listTeachersAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les enseignants",
      },
    };
  }
}

/**
 * List students on the platform (for a school_admin to find and invite).
 */
export async function listStudentsAction(
  input: ListStudentsInput,
): Promise<ApiResponse<ListResult<StudentCardData>>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, input.pageSize ?? 12));

    const db = await getDb();

    // 1) Build query: role = "student".
    const conditions: SQL[] = [eq(users.role, "student")];
    if (input.search) {
      const needle = `%${input.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, needle),
          ilike(users.lastName, needle),
          ilike(users.email, needle),
        )!,
      );
    }
    if (input.level) {
      conditions.push(eq(users.level, input.level as never));
    }

    const where = and(...conditions);

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          avatarUrl: users.avatarUrl,
          level: users.level,
          series: users.series,
          currentStreak: users.currentStreak,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(users).where(where),
    ]);

    const total = Number(countRows.at(0)?.c ?? 0);
    if (rows.length === 0) {
      return {
        success: true,
        data: { items: [], total, page, hasMore: false },
      };
    }

    // 2) Per-student aggregates: XP, badges count, quizzes completed, avg score.
    const studentIds = rows.map((r) => r.id);

    const [xpRows, badgeRows, sessionRows] = await Promise.all([
      db
        .select({ userId: userPoints.userId, totalXp: userPoints.totalXp })
        .from(userPoints)
        .where(inArray(userPoints.userId, studentIds)),
      db
        .select({ userId: userBadges.userId, c: count() })
        .from(userBadges)
        .where(inArray(userBadges.userId, studentIds))
        .groupBy(userBadges.userId),
      db
        .select({
          userId: quizSessions.userId,
          c: count(),
          avg: sql<number>`coalesce(avg(${quizSessions.totalScore}::numeric * 100 / nullif(${quizSessions.maxScore}, 0)), 0)`,
        })
        .from(quizSessions)
        .where(
          and(
            inArray(quizSessions.userId, studentIds),
            eq(quizSessions.status, "completed"),
          ),
        )
        .groupBy(quizSessions.userId),
    ]);

    const xpByStudent = new Map<string, number>();
    for (const r of xpRows) xpByStudent.set(r.userId, r.totalXp);
    const badgesByStudent = new Map<string, number>();
    for (const r of badgeRows) badgesByStudent.set(r.userId, Number(r.c));
    const sessionsByStudent = new Map<string, { count: number; avg: number }>();
    for (const r of sessionRows) {
      sessionsByStudent.set(r.userId, {
        count: Number(r.c),
        avg: toRating(r.avg),
      });
    }

    const items: StudentCardData[] = rows.map((r) => {
      const sess = sessionsByStudent.get(r.id);
      const avg = sess && sess.count > 0 ? Math.round(sess.avg) : null;
      return {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        avatarUrl: r.avatarUrl,
        level: r.level,
        series: r.series,
        currentStreak: r.currentStreak,
        xpPoints: xpByStudent.get(r.id) ?? 0,
        badgesCount: badgesByStudent.get(r.id) ?? 0,
        quizzesCompleted: sess?.count ?? 0,
        avgScore: avg,
      };
    });

    return {
      success: true,
      data: {
        items,
        total,
        page,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listStudentsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les élèves",
      },
    };
  }
}

/**
 * List tutors (public profiles) — visible to students and parents.
 */
export async function listTutorsAction(
  input: ListTutorsInput,
): Promise<ApiResponse<ListResult<TutorCardData>>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, input.pageSize ?? 12));

    const db = await getDb();

    // 1) Build query: tutor_profiles join users.
    const conditions: SQL[] = [];
    if (input.search) {
      const needle = `%${input.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, needle),
          ilike(users.lastName, needle),
          ilike(tutorProfiles.bio, needle),
          ilike(tutorProfiles.location, needle),
        )!,
      );
    }
    if (input.verifiedOnly) {
      conditions.push(eq(tutorProfiles.isVerified, true));
    }
    if (
      typeof input.minRating === "number" &&
      Number.isFinite(input.minRating)
    ) {
      conditions.push(
        sql`${tutorProfiles.ratingAvg}::numeric >= ${input.minRating}`,
      );
    }

    // 2) Resolve subject filter → list of tutor profile ids.
    let profileIdWhitelist: string[] | null = null;
    if (input.subject) {
      const subjRows = await db
        .select()
        .from(subjects)
        .where(
          or(
            eq(subjects.name, input.subject),
            ilike(subjects.code, input.subject.toUpperCase()),
          ),
        )
        .limit(1);
      const subj = subjRows.at(0);
      if (!subj) {
        return {
          success: true,
          data: { items: [], total: 0, page, hasMore: false },
        };
      }
      const tsRows = await db
        .select({ profileId: tutorSubjects.tutorProfileId })
        .from(tutorSubjects)
        .where(eq(tutorSubjects.subjectId, subj.id));
      profileIdWhitelist = tsRows.map((r) => r.profileId);
      if (profileIdWhitelist.length === 0) {
        return {
          success: true,
          data: { items: [], total: 0, page, hasMore: false },
        };
      }
      conditions.push(inArray(tutorProfiles.id, profileIdWhitelist));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // 3) Count + paginate.
    const [rows, countRows] = await Promise.all([
      db
        .select({
          profile: tutorProfiles,
          user: users,
        })
        .from(tutorProfiles)
        .innerJoin(users, eq(users.id, tutorProfiles.userId))
        .where(where ?? sql`true`)
        .orderBy(desc(tutorProfiles.isVerified), desc(tutorProfiles.ratingAvg))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ c: count() })
        .from(tutorProfiles)
        .innerJoin(users, eq(users.id, tutorProfiles.userId))
        .where(where ?? sql`true`),
    ]);

    const total = Number(countRows.at(0)?.c ?? 0);
    if (rows.length === 0) {
      return {
        success: true,
        data: { items: [], total, page, hasMore: false },
      };
    }

    // 4) Subjects for these tutor profiles.
    const profileIds = rows.map((r) => r.profile.id);
    const subjectRows = await db
      .select({
        profileId: tutorSubjects.tutorProfileId,
        subjectName: subjects.name,
      })
      .from(tutorSubjects)
      .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
      .where(inArray(tutorSubjects.tutorProfileId, profileIds));

    const subjectsByProfile = new Map<string, string[]>();
    for (const r of subjectRows) {
      const arr = subjectsByProfile.get(r.profileId) ?? [];
      if (!arr.includes(r.subjectName)) arr.push(r.subjectName);
      subjectsByProfile.set(r.profileId, arr);
    }

    const items: TutorCardData[] = rows.map(({ profile, user }) => ({
      id: profile.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: profile.bio,
      hourlyRate: profile.hourlyRate,
      location: profile.location,
      subjects: subjectsByProfile.get(profile.id) ?? [],
      rating: toRating(profile.ratingAvg),
      reviewCount: profile.ratingCount,
      isVerified: profile.isVerified,
      totalSessions: 0, // Would come from tutor_bookings; left as 0 for the listing.
    }));

    return {
      success: true,
      data: {
        items,
        total,
        page,
        hasMore: page * pageSize < total,
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listTutorsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les tuteurs",
      },
    };
  }
}

/* ── Subjects list helper ─────────────────────────────────── */

/**
 * Returns the global subject catalog (id + name) so the explorer's
 * subject filter dropdown can be populated server-side.
 */
export async function listSubjectsForFilterAction(): Promise<
  ApiResponse<Pick<Subject, "id" | "name">[]>
> {
  try {
    await requireSession();

    const db = await getDb();
    const rows = await db
      .select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .orderBy(subjects.name);
    return { success: true, data: rows };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listSubjectsForFilterAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les matières",
      },
    };
  }
}
