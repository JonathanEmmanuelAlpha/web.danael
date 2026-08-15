/**
 * §5.15 — Tutoring marketplace service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Booking flow:  pending → confirmed → completed
 *                          ↘ cancelled (at any step)
 *
 * Rating:        on new review, the tutor_profile.ratingAvg / ratingCount
 *                are recalculated atomically.
 */

import {
  and,
  avg,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  SQL,
  sql,
} from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  subjects,
  tutorAvailabilities,
  tutorBookings,
  tutorProfiles,
  tutorReviews,
  tutorSubjects,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type {
  AddTutorSubjectInput,
  CreateBookingInput,
  CreateReviewInput,
  CreateTutorProfileInput,
  ListTutorBookingsQuery,
  ListTutorReviewsQuery,
  ListTutorsQuery,
  ModerateReviewInput,
  RemoveTutorSubjectInput,
  RescheduleBookingInput,
  SetAvailabilityInput,
  UpdateTutorProfileInput,
} from "@/server/validators/tutoring";
import type {
  TutorAvailability,
  TutorBooking,
  TutorProfile,
  TutorReview,
  TutorSubject,
} from "@/server/db/schema/tutoring";
import type { User } from "@/server/db/schema/users";
import type { Subject } from "@/server/db/schema/schools";

/* -- Types --------------------------------------------------- */

export type {
  TutorProfile,
  TutorSubject,
  TutorAvailability,
  TutorBooking,
  TutorReview,
};

export type TutorProfileWithUser = TutorProfile & {
  user: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl" | "level"
  >;
};

export type TutorProfilePublic = TutorProfile & {
  user: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl" | "level"
  >;
  subjects: Array<{
    id: string;
    subject: Pick<Subject, "id" | "name" | "code">;
    level: string | null;
  }>;
  availabilities: TutorAvailability[];
  /** Numeric rating (0-5). */
  ratingAvgNumber: number;
};

export type TutorListItem = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  level: string | null;
  bio: string | null;
  location: string | null;
  hourlyRate: number | null;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  subjectCount: number;
  subjects: Array<{
    id: string;
    name: string;
    code: string | null;
    level: string | null;
  }>;
};

export type BookingWithRelations = TutorBooking & {
  tutorProfile: TutorProfile & {
    user: Pick<User, "id" | "firstName" | "lastName" | "email" | "avatarUrl">;
  };
  student: Pick<User, "id" | "firstName" | "lastName" | "email" | "avatarUrl">;
  bookedByUser: Pick<User, "id" | "firstName" | "lastName" | "email">;
};

export type ReviewWithReviewer = TutorReview & {
  reviewer: Pick<User, "id" | "firstName" | "lastName" | "avatarUrl">;
};

export type TutorEarnings = {
  totalCompleted: number;
  totalRevenue: number;
  upcomingCount: number;
  pendingCount: number;
  monthly: Array<{ month: string; revenue: number; sessions: number }>;
};

/* -- Helpers ------------------------------------------------ */

function toRating(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/* -- Tutor profile mutations -------------------------------- */

export async function createTutorProfile(
  userId: string,
  input: CreateTutorProfileInput,
): Promise<TutorProfile> {
  const db = await getDb();

  // Reject duplicates (one profile per user).
  const existing = await db
    .select({ id: tutorProfiles.id })
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, userId))
    .limit(1);
  if (existing.length > 0) {
    throw AppError.conflict("Vous avez déjà un profil de tuteur");
  }

  const [created] = await db
    .insert(tutorProfiles)
    .values({
      userId,
      bio: input.bio,
      hourlyRate: input.hourlyRate,
      location: input.location,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create tutor profile");
  return created;
}

export async function updateTutorProfile(
  userId: string,
  input: UpdateTutorProfileInput,
): Promise<TutorProfile> {
  const db = await getDb();
  const [updated] = await db
    .update(tutorProfiles)
    .set({
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.hourlyRate !== undefined
        ? { hourlyRate: input.hourlyRate }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tutorProfiles.userId, userId))
    .returning();
  if (!updated) throw AppError.notFound("Tutor profile not found");
  return updated;
}

export async function verifyTutor(profileId: string): Promise<TutorProfile> {
  const db = await getDb();
  const [updated] = await db
    .update(tutorProfiles)
    .set({ isVerified: true, updatedAt: new Date() })
    .where(eq(tutorProfiles.id, profileId))
    .returning();
  if (!updated) throw AppError.notFound("Tutor profile not found");
  return updated;
}

/* -- Tutor profile queries ---------------------------------- */

export async function getTutorProfile(
  userId: string,
): Promise<TutorProfile | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, userId))
    .limit(1);
  return rows.at(0) ?? null;
}

export async function getTutorProfileById(
  profileId: string,
): Promise<TutorProfilePublic | null> {
  const db = await getDb();

  const rows = await db
    .select({
      profile: tutorProfiles,
      user: users,
    })
    .from(tutorProfiles)
    .innerJoin(users, eq(users.id, tutorProfiles.userId))
    .where(eq(tutorProfiles.id, profileId))
    .limit(1);
  const row = rows.at(0);
  if (!row) return null;

  const [subjectRows, availRows] = await Promise.all([
    db
      .select({
        id: tutorSubjects.id,
        subject: subjects,
        level: tutorSubjects.level,
      })
      .from(tutorSubjects)
      .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
      .where(eq(tutorSubjects.tutorProfileId, profileId)),
    db
      .select()
      .from(tutorAvailabilities)
      .where(eq(tutorAvailabilities.tutorProfileId, profileId))
      .orderBy(tutorAvailabilities.dayOfWeek, tutorAvailabilities.startTime),
  ]);

  return {
    ...row.profile,
    user: {
      id: row.user.id,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      email: row.user.email,
      avatarUrl: row.user.avatarUrl,
      level: row.user.level,
    },
    subjects: subjectRows.map((s) => ({
      id: s.id,
      subject: { id: s.subject.id, name: s.subject.name, code: s.subject.code },
      level: s.level,
    })),
    availabilities: availRows,
    ratingAvgNumber: toRating(row.profile.ratingAvg),
  };
}

export async function listTutors(filters: ListTutorsQuery): Promise<{
  items: TutorListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();

  const conditions: SQL<unknown>[] = [];
  if (filters.search) {
    const needle = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(users.firstName, needle),
        ilike(users.lastName, needle),
        ilike(tutorProfiles.bio, needle),
        ilike(tutorProfiles.location, needle),
      ) as never,
    );
  }
  if (filters.location) {
    conditions.push(ilike(tutorProfiles.location, `%${filters.location}%`));
  }
  if (filters.verifiedOnly) {
    conditions.push(eq(tutorProfiles.isVerified, true));
  }
  if (filters.minRating !== undefined) {
    conditions.push(gte(tutorProfiles.ratingAvg, filters.minRating.toString()));
  }
  if (filters.maxRate !== undefined) {
    conditions.push(lte(tutorProfiles.hourlyRate, filters.maxRate));
  }

  // Subject filter: if set, we'll restrict profile IDs to those who teach it.
  let profileIdWhitelist: string[] | null = null;
  if (filters.subjectId || filters.level) {
    const subjQuery = db
      .select({ profileId: tutorSubjects.tutorProfileId })
      .from(tutorSubjects);
    const subjConds = [];
    if (filters.subjectId) {
      subjConds.push(eq(tutorSubjects.subjectId, filters.subjectId));
    }
    if (filters.level) {
      subjConds.push(eq(tutorSubjects.level, filters.level) as never);
    }
    const subjRows = await subjQuery.where(and(...subjConds));
    profileIdWhitelist = subjRows.map((r) => r.profileId);
    if (profileIdWhitelist.length === 0) {
      return {
        items: [],
        total: 0,
        page: filters.page,
        pageSize: filters.pageSize,
      };
    }
  }

  if (profileIdWhitelist) {
    conditions.push(inArray(tutorProfiles.id, profileIdWhitelist) as never);
  }

  const where =
    conditions.length === 0 ? undefined : (and(...conditions) as never);

  // Count
  const countRows = where
    ? await db
        .select({ c: count() })
        .from(tutorProfiles)
        .innerJoin(users, eq(users.id, tutorProfiles.userId))
        .where(where)
    : await db
        .select({ c: count() })
        .from(tutorProfiles)
        .innerJoin(users, eq(users.id, tutorProfiles.userId));
  const total = Number(countRows.at(0)?.c ?? 0);

  const offset = (filters.page - 1) * filters.pageSize;
  const rows = await db
    .select({
      profile: tutorProfiles,
      user: users,
    })
    .from(tutorProfiles)
    .innerJoin(users, eq(users.id, tutorProfiles.userId))
    .where(where ?? sql`true`)
    .orderBy(desc(tutorProfiles.isVerified), desc(tutorProfiles.ratingAvg))
    .limit(filters.pageSize)
    .offset(offset);

  if (rows.length === 0) {
    return { items: [], total, page: filters.page, pageSize: filters.pageSize };
  }

  // Subjects for these tutors.
  const profileIds = rows.map((r) => r.profile.id);
  const subjectRows = await db
    .select({
      profileId: tutorSubjects.tutorProfileId,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      level: tutorSubjects.level,
    })
    .from(tutorSubjects)
    .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
    .where(inArray(tutorSubjects.tutorProfileId, profileIds));

  const subjectMap = new Map<
    string,
    Array<{
      id: string;
      name: string;
      code: string | null;
      level: string | null;
    }>
  >();
  const subjectCountMap = new Map<string, number>();
  for (const s of subjectRows) {
    const arr = subjectMap.get(s.profileId) ?? [];
    arr.push({
      id: s.subjectId,
      name: s.subjectName,
      code: s.subjectCode,
      level: s.level,
    });
    subjectMap.set(s.profileId, arr);
    subjectCountMap.set(
      s.profileId,
      (subjectCountMap.get(s.profileId) ?? 0) + 1,
    );
  }

  const items: TutorListItem[] = rows.map(({ profile, user }) => ({
    id: profile.id,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    level: user.level,
    bio: profile.bio,
    location: profile.location,
    hourlyRate: profile.hourlyRate,
    isVerified: profile.isVerified,
    ratingAvg: toRating(profile.ratingAvg),
    ratingCount: profile.ratingCount,
    subjectCount: subjectCountMap.get(profile.id) ?? 0,
    subjects: subjectMap.get(profile.id) ?? [],
  }));

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

/* -- Tutor subjects ----------------------------------------- */

export async function addTutorSubject(
  input: AddTutorSubjectInput,
): Promise<TutorSubject> {
  const db = await getDb();
  // Idempotent: if the subject is already added, do nothing (return existing).
  const existing = await db
    .select()
    .from(tutorSubjects)
    .where(
      and(
        eq(tutorSubjects.tutorProfileId, input.profileId),
        eq(tutorSubjects.subjectId, input.subjectId),
      ),
    )
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(tutorSubjects)
    .values({
      tutorProfileId: input.profileId,
      subjectId: input.subjectId,
      level: input.level,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to add tutor subject");
  return created;
}

export async function removeTutorSubject(
  input: RemoveTutorSubjectInput,
): Promise<{ removed: boolean }> {
  const db = await getDb();
  await db
    .delete(tutorSubjects)
    .where(
      and(
        eq(tutorSubjects.tutorProfileId, input.profileId),
        eq(tutorSubjects.subjectId, input.subjectId),
      ),
    );
  return { removed: true };
}

/* -- Availabilities ----------------------------------------- */

export async function setAvailability(
  input: SetAvailabilityInput,
): Promise<TutorAvailability[]> {
  const db = await getDb();
  // Replace-all strategy: wipe existing slots then insert new ones.
  await db
    .delete(tutorAvailabilities)
    .where(eq(tutorAvailabilities.tutorProfileId, input.profileId));

  if (input.slots.length === 0) return [];

  const inserted = await db
    .insert(tutorAvailabilities)
    .values(
      input.slots.map((s) => ({
        tutorProfileId: input.profileId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    )
    .returning();
  return inserted;
}

export async function getAvailability(
  profileId: string,
): Promise<TutorAvailability[]> {
  const db = await getDb();
  return db
    .select()
    .from(tutorAvailabilities)
    .where(eq(tutorAvailabilities.tutorProfileId, profileId))
    .orderBy(tutorAvailabilities.dayOfWeek, tutorAvailabilities.startTime);
}

/**
 * Check whether the tutor is available at the given datetime.
 * Compares the weekday and time-of-day against the tutor's recurring slots.
 */
export async function checkAvailability(
  profileId: string,
  dateTime: Date,
): Promise<boolean> {
  const slots = await getAvailability(profileId);
  if (slots.length === 0) return false;
  const dayOfWeek = dateTime.getDay(); // 0..6 (Sun..Sat)
  const hh = dateTime.getHours().toString().padStart(2, "0");
  const mm = dateTime.getMinutes().toString().padStart(2, "0");
  const time = `${hh}:${mm}`;
  return slots.some(
    (s) => s.dayOfWeek === dayOfWeek && s.startTime <= time && s.endTime > time,
  );
}

/* -- Bookings ----------------------------------------------- */

export async function createBooking(
  input: CreateBookingInput,
  bookedBy: string,
): Promise<TutorBooking> {
  const db = await getDb();

  // Resolve the tutor profile.
  const profile = await getTutorProfileById(input.tutorProfileId);
  if (!profile) throw AppError.notFound("Tutor profile not found");

  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw AppError.validation("Invalid scheduledAt date");
  }
  if (scheduledAt.getTime() < Date.now() - 5 * 60 * 1000) {
    throw AppError.validation(
      "La date de séance ne peut pas être dans le passé",
    );
  }

  // Compute the price.
  const price = input.price ?? profile.hourlyRate ?? 0;

  const [created] = await db
    .insert(tutorBookings)
    .values({
      tutorProfileId: input.tutorProfileId,
      studentId: input.studentId,
      bookedBy,
      scheduledAt,
      price,
      status: "pending",
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create booking");
  return created;
}

export async function getBooking(
  bookingId: string,
): Promise<BookingWithRelations | null> {
  const db = await getDb();
  const rows = await db
    .select({
      booking: tutorBookings,
      tutorProfile: tutorProfiles,
    })
    .from(tutorBookings)
    .innerJoin(
      tutorProfiles,
      eq(tutorProfiles.id, tutorBookings.tutorProfileId),
    )
    .where(eq(tutorBookings.id, bookingId))
    .limit(1);

  const row = rows.at(0);
  if (!row) return null;

  // Resolve the three user relations separately to avoid ambiguous joins.
  const [tutorUserRow, studentRow, bookedByRow] = await Promise.all([
    db
      .select()
      .from(users)
      .where(eq(users.id, row.tutorProfile.userId))
      .limit(1),
    db.select().from(users).where(eq(users.id, row.booking.studentId)).limit(1),
    db.select().from(users).where(eq(users.id, row.booking.bookedBy)).limit(1),
  ]);
  const tutorUser = tutorUserRow.at(0);
  const student = studentRow.at(0);
  const bookedByUser = bookedByRow.at(0);
  if (!tutorUser || !student || !bookedByUser) return null;

  return {
    ...row.booking,
    tutorProfile: {
      ...row.tutorProfile,
      user: {
        id: tutorUser.id,
        firstName: tutorUser.firstName,
        lastName: tutorUser.lastName,
        email: tutorUser.email,
        avatarUrl: tutorUser.avatarUrl,
      },
    },
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      avatarUrl: student.avatarUrl,
    },
    bookedByUser: {
      id: bookedByUser.id,
      firstName: bookedByUser.firstName,
      lastName: bookedByUser.lastName,
      email: bookedByUser.email,
    },
  };
}

export async function listTutorBookings(
  filters: ListTutorBookingsQuery,
): Promise<{
  items: TutorBooking[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();
  const conditions = [eq(tutorBookings.tutorProfileId, filters.tutorProfileId)];
  if (filters.status) {
    conditions.push(eq(tutorBookings.status, filters.status) as never);
  }
  if (filters.upcoming) {
    conditions.push(gte(tutorBookings.scheduledAt, new Date()) as never);
  }

  const countRows = await db
    .select({ c: count() })
    .from(tutorBookings)
    .where(and(...conditions));
  const total = Number(countRows.at(0)?.c ?? 0);

  const offset = (filters.page - 1) * filters.pageSize;
  const items = await db
    .select()
    .from(tutorBookings)
    .where(and(...conditions))
    .orderBy(desc(tutorBookings.scheduledAt))
    .limit(filters.pageSize)
    .offset(offset);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function listStudentBookings(
  studentId: string,
): Promise<TutorBooking[]> {
  const db = await getDb();
  return db
    .select()
    .from(tutorBookings)
    .where(eq(tutorBookings.studentId, studentId))
    .orderBy(desc(tutorBookings.scheduledAt));
}

export async function listParentBookings(
  parentId: string,
): Promise<TutorBooking[]> {
  const db = await getDb();
  return db
    .select()
    .from(tutorBookings)
    .where(eq(tutorBookings.bookedBy, parentId))
    .orderBy(desc(tutorBookings.scheduledAt));
}

/**
 * Transition: pending → confirmed. Only the tutor can confirm.
 */
export async function confirmBooking(bookingId: string): Promise<TutorBooking> {
  const db = await getDb();
  const current = await db
    .select()
    .from(tutorBookings)
    .where(eq(tutorBookings.id, bookingId))
    .limit(1);
  const booking = current.at(0);
  if (!booking) throw AppError.notFound("Booking not found");
  if (booking.status !== "pending") {
    throw AppError.conflict(
      `La réservation n'est plus en attente (statut: ${booking.status})`,
    );
  }
  const [updated] = await db
    .update(tutorBookings)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(tutorBookings.id, bookingId))
    .returning();
  if (!updated) throw AppError.internal("Failed to confirm booking");
  return updated;
}

export async function cancelBooking(
  bookingId: string,
  reason?: string,
): Promise<TutorBooking> {
  const db = await getDb();
  const current = await db
    .select()
    .from(tutorBookings)
    .where(eq(tutorBookings.id, bookingId))
    .limit(1);
  const booking = current.at(0);
  if (!booking) throw AppError.notFound("Booking not found");
  if (booking.status === "cancelled") {
    throw AppError.conflict("La réservation est déjà annulée");
  }
  if (booking.status === "completed") {
    throw AppError.conflict("Impossible d'annuler une séance terminée");
  }
  const [updated] = await db
    .update(tutorBookings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(tutorBookings.id, bookingId))
    .returning();
  if (!updated) throw AppError.internal("Failed to cancel booking");
  // Reason is not stored on the booking row in the current schema; log it.
  if (reason) {
    void reason;
  }
  return updated;
}

export async function completeBooking(
  bookingId: string,
): Promise<TutorBooking> {
  const db = await getDb();
  const current = await db
    .select()
    .from(tutorBookings)
    .where(eq(tutorBookings.id, bookingId))
    .limit(1);
  const booking = current.at(0);
  if (!booking) throw AppError.notFound("Booking not found");
  if (booking.status !== "confirmed") {
    throw AppError.conflict(
      `La séance doit être confirmée avant d'être terminée (statut: ${booking.status})`,
    );
  }
  const [updated] = await db
    .update(tutorBookings)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(tutorBookings.id, bookingId))
    .returning();
  if (!updated) throw AppError.internal("Failed to complete booking");
  return updated;
}

export async function rescheduleBooking(
  input: RescheduleBookingInput,
): Promise<TutorBooking> {
  const db = await getDb();
  const newDate = new Date(input.newDateTime);
  if (Number.isNaN(newDate.getTime())) {
    throw AppError.validation("Invalid newDateTime");
  }
  if (newDate.getTime() < Date.now() - 5 * 60 * 1000) {
    throw AppError.validation(
      "La nouvelle date ne peut pas être dans le passé",
    );
  }
  const current = await db
    .select()
    .from(tutorBookings)
    .where(eq(tutorBookings.id, input.bookingId))
    .limit(1);
  const booking = current.at(0);
  if (!booking) throw AppError.notFound("Booking not found");
  if (booking.status === "cancelled" || booking.status === "completed") {
    throw AppError.conflict(
      `Impossible de replanifier une séance ${booking.status}`,
    );
  }
  const [updated] = await db
    .update(tutorBookings)
    .set({ scheduledAt: newDate, updatedAt: new Date() })
    .where(eq(tutorBookings.id, input.bookingId))
    .returning();
  if (!updated) throw AppError.internal("Failed to reschedule booking");
  return updated;
}

/* -- Reviews ------------------------------------------------ */

export async function createReview(
  input: CreateReviewInput,
  reviewerId: string,
): Promise<TutorReview> {
  const db = await getDb();

  const bookingRows = await db
    .select()
    .from(tutorBookings)
    .where(eq(tutorBookings.id, input.bookingId))
    .limit(1);
  const booking = bookingRows.at(0);
  if (!booking) throw AppError.notFound("Booking not found");
  if (booking.status !== "completed") {
    throw AppError.validation(
      "Vous ne pouvez évaluer que les séances terminées",
    );
  }
  // Reviewer must be the student or the booking's parent.
  if (reviewerId !== booking.studentId && reviewerId !== booking.bookedBy) {
    throw AppError.forbidden(
      "Seul l'élève ou le parent commanditaire peut évaluer",
    );
  }
  // One review per booking.
  const existingReview = await db
    .select({ id: tutorReviews.id })
    .from(tutorReviews)
    .where(eq(tutorReviews.bookingId, input.bookingId))
    .limit(1);
  if (existingReview.length > 0) {
    throw AppError.conflict("Cette séance a déjà été évaluée");
  }

  const [created] = await db
    .insert(tutorReviews)
    .values({
      bookingId: input.bookingId,
      reviewerId,
      rating: input.rating,
      comment: input.comment,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create review");

  // Recalculate the tutor's rating_avg + rating_count.
  await recalculateTutorRating(booking.tutorProfileId);

  return created;
}

export async function listTutorReviews(
  filters: ListTutorReviewsQuery,
): Promise<{
  items: ReviewWithReviewer[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();
  const countRows = await db
    .select({ c: count() })
    .from(tutorReviews)
    .innerJoin(tutorBookings, eq(tutorBookings.id, tutorReviews.bookingId))
    .where(eq(tutorBookings.tutorProfileId, filters.tutorProfileId));
  const total = Number(countRows.at(0)?.c ?? 0);

  const offset = (filters.page - 1) * filters.pageSize;
  const rows = await db
    .select({
      review: tutorReviews,
      reviewer: users,
    })
    .from(tutorReviews)
    .innerJoin(tutorBookings, eq(tutorBookings.id, tutorReviews.bookingId))
    .innerJoin(users, eq(users.id, tutorReviews.reviewerId))
    .where(eq(tutorBookings.tutorProfileId, filters.tutorProfileId))
    .orderBy(desc(tutorReviews.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

  const items = rows.map((r) => ({
    ...r.review,
    reviewer: {
      id: r.reviewer.id,
      firstName: r.reviewer.firstName,
      lastName: r.reviewer.lastName,
      avatarUrl: r.reviewer.avatarUrl,
    },
  }));

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function moderateReview(
  input: ModerateReviewInput,
): Promise<{ moderated: boolean; action: string }> {
  const db = await getDb();
  // The schema doesn't have a "hidden" flag — moderation here is a soft delete.
  if (input.action === "hide") {
    await db.delete(tutorReviews).where(eq(tutorReviews.id, input.reviewId));
    // Recompute the tutor's average.
    const bookingRow = await db
      .select({ tutorProfileId: tutorBookings.tutorProfileId })
      .from(tutorBookings)
      .where(eq(tutorBookings.id, input.reviewId))
      .limit(1);
    if (bookingRow.at(0)) {
      await recalculateTutorRating(bookingRow[0].tutorProfileId);
    }
    return { moderated: true, action: "hide" };
  }
  return { moderated: true, action: "approve" };
}

/**
 * Recalculate the rating_avg + rating_count for a tutor profile.
 */
async function recalculateTutorRating(profileId: string): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({
      avgRating: avg(tutorReviews.rating),
      total: count(),
    })
    .from(tutorReviews)
    .innerJoin(tutorBookings, eq(tutorBookings.id, tutorReviews.bookingId))
    .where(eq(tutorBookings.tutorProfileId, profileId));

  const avgValue = toRating(rows.at(0)?.avgRating);
  const totalValue = Number(rows.at(0)?.total ?? 0);

  await db
    .update(tutorProfiles)
    .set({
      ratingAvg: avgValue.toFixed(2),
      ratingCount: totalValue,
      updatedAt: new Date(),
    })
    .where(eq(tutorProfiles.id, profileId));
}

/* -- Tutor earnings ----------------------------------------- */

export async function getTutorEarnings(
  profileId: string,
): Promise<TutorEarnings> {
  const db = await getDb();
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const bookings = await db
    .select({
      id: tutorBookings.id,
      status: tutorBookings.status,
      price: tutorBookings.price,
      scheduledAt: tutorBookings.scheduledAt,
    })
    .from(tutorBookings)
    .where(eq(tutorBookings.tutorProfileId, profileId));

  const completed = bookings.filter((b) => b.status === "completed");
  const totalRevenue = completed.reduce((acc, b) => acc + (b.price ?? 0), 0);
  const upcomingCount = bookings.filter(
    (b) => b.status === "confirmed" && b.scheduledAt >= now,
  ).length;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  // Build monthly buckets for the current year.
  const monthlyMap = new Map<number, { revenue: number; sessions: number }>();
  for (let m = 0; m < 12; m++) monthlyMap.set(m, { revenue: 0, sessions: 0 });
  for (const b of completed) {
    if (b.scheduledAt >= startOfYear) {
      const m = b.scheduledAt.getMonth();
      const entry = monthlyMap.get(m)!;
      entry.revenue += b.price ?? 0;
      entry.sessions += 1;
    }
  }
  const monthLabels = [
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Jun",
    "Jui",
    "Aoû",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
  ];
  const monthly = Array.from(monthlyMap.entries()).map(([m, v]) => ({
    month: monthLabels[m],
    revenue: v.revenue,
    sessions: v.sessions,
  }));

  return {
    totalCompleted: completed.length,
    totalRevenue,
    upcomingCount,
    pendingCount,
    monthly,
  };
}
