"use server";

/**
 * §5.15 — Tutoring server actions.
 *
 * Wraps the tutoring service with auth + RBAC + Zod validation. Each action
 * returns a typed ApiResponse<T>.
 *
 * Authorization rules:
 *  - Profile management: tutor owns their own profile.
 *  - Availability: tutor owns their own profile.
 *  - Booking creation: student or parent of student can book.
 *  - Booking transitions:
 *      confirm/complete/reschedule → tutor only
 *      cancel → either tutor or booker
 *  - Review creation: booker or student of a completed booking.
 *  - Moderation: platform_admin / content_moderator only.
 */

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isParentOf, requireRole } from "@/server/permissions";
import { getDb } from "@/server/db";
import { tutorProfiles, tutorBookings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import * as tutoringService from "@/server/services/tutoring";
import {
  addTutorSubjectSchema,
  cancelBookingSchema,
  createBookingSchema,
  createReviewSchema,
  createTutorProfileSchema,
  listTutorBookingsQuerySchema,
  listTutorReviewsQuerySchema,
  listTutorsQuerySchema,
  moderateReviewSchema,
  removeTutorSubjectSchema,
  rescheduleBookingSchema,
  setAvailabilitySchema,
  updateTutorProfileSchema,
} from "@/server/validators/tutoring";
import type {
  BookingWithRelations,
  ReviewWithReviewer,
  TutorAvailability,
  TutorEarnings,
  TutorListItem,
  TutorProfile,
  TutorProfilePublic,
} from "@/server/services/tutoring";

/* ── Helpers ───────────────────────────────────────────────── */

async function requireTutor(): Promise<{ userId: string; profileId: string }> {
  await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    throw AppError.notFound(
      "User profile not found. Please complete onboarding.",
    );
  }
  requireRole(dbUser.role, "tutor", "platform_admin");
  const db = await getDb();
  const rows = await db
    .select()
    .from(tutorProfiles)
    .where(eq(tutorProfiles.userId, dbUser.id))
    .limit(1);
  const profile = rows.at(0);
  if (!profile) {
    throw AppError.notFound(
      "Profil de tuteur introuvable. Complétez votre profil.",
    );
  }
  return { userId: dbUser.id, profileId: profile.id };
}

async function requireTutorProfileOwner(
  profileId: string,
): Promise<{ userId: string; profileId: string }> {
  const { userId, profileId: ownProfileId } = await requireTutor();
  if (profileId !== ownProfileId) {
    throw AppError.forbidden("Vous ne pouvez gérer que votre propre profil");
  }
  return { userId, profileId };
}

async function requireBookerOrStudent(
  bookingId: string,
): Promise<{ userId: string; booking: BookingWithRelations }> {
  await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    throw AppError.notFound(
      "User profile not found. Please complete onboarding.",
    );
  }
  const booking = await tutoringService.getBooking(bookingId);
  if (!booking) throw AppError.notFound("Réservation introuvable");
  const isStudent = booking.student.id === dbUser.id;
  const isBooker = booking.bookedByUser.id === dbUser.id;
  const isTutor = booking.tutorProfile.user.id === dbUser.id;
  if (!isStudent && !isBooker && !isTutor) {
    throw AppError.forbidden("Vous n'avez pas accès à cette réservation");
  }
  return { userId: dbUser.id, booking };
}

function handleErr(err: unknown, label: string): ApiResponse<never> {
  if (err instanceof AppError) {
    return { success: false, error: { code: err.code, message: err.message } };
  }
  logger.error(`${label} failed`, { error: String(err) });
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Erreur inattendue" },
  };
}

/* ── Tutor profile mutations ──────────────────────────────── */

export async function createTutorProfileAction(
  input: z.input<typeof createTutorProfileSchema>,
): Promise<ApiResponse<TutorProfile>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    requireRole(dbUser.role, "tutor", "platform_admin");

    const parsed = createTutorProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const profile = await tutoringService.createTutorProfile(
      dbUser.id,
      parsed.data,
    );
    logger.info("Tutor profile created", {
      profileId: profile.id,
      userId: dbUser.id,
    });
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { success: true, data: profile };
  } catch (err) {
    return handleErr(err, "createTutorProfileAction");
  }
}

export async function updateTutorProfileAction(
  input: z.input<typeof updateTutorProfileSchema>,
): Promise<ApiResponse<TutorProfile>> {
  try {
    const { userId } = await requireTutor();
    const parsed = updateTutorProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const updated = await tutoringService.updateTutorProfile(
      userId,
      parsed.data,
    );
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { success: true, data: updated };
  } catch (err) {
    return handleErr(err, "updateTutorProfileAction");
  }
}

export async function verifyTutorAction(
  profileId: string,
): Promise<ApiResponse<TutorProfile>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    requireRole(dbUser.role, "platform_admin");
    const updated = await tutoringService.verifyTutor(profileId);
    logger.info("Tutor verified", { profileId, byUserId: dbUser.id });
    revalidatePath(`/tutors/${profileId}`);
    return { success: true, data: updated };
  } catch (err) {
    return handleErr(err, "verifyTutorAction");
  }
}

export async function addTutorSubjectAction(
  input: z.input<typeof addTutorSubjectSchema>,
): Promise<
  ApiResponse<{ id: string; subjectId: string; level: string | null }>
> {
  try {
    const parsed = addTutorSubjectSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    await requireTutorProfileOwner(parsed.data.profileId);
    const result = await tutoringService.addTutorSubject(parsed.data);
    revalidatePath("/profile");
    return {
      success: true,
      data: {
        id: result.id,
        subjectId: result.subjectId,
        level: result.level,
      },
    };
  } catch (err) {
    return handleErr(err, "addTutorSubjectAction");
  }
}

export async function removeTutorSubjectAction(
  input: z.input<typeof removeTutorSubjectSchema>,
): Promise<ApiResponse<{ removed: boolean }>> {
  try {
    const parsed = removeTutorSubjectSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    await requireTutorProfileOwner(parsed.data.profileId);
    const result = await tutoringService.removeTutorSubject(parsed.data);
    revalidatePath("/profile");
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "removeTutorSubjectAction");
  }
}

/* ── Availabilities ──────────────────────────────────────── */

export async function setAvailabilityAction(
  input: z.input<typeof setAvailabilitySchema>,
): Promise<ApiResponse<TutorAvailability[]>> {
  try {
    const parsed = setAvailabilitySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    await requireTutorProfileOwner(parsed.data.profileId);
    const slots = await tutoringService.setAvailability(parsed.data);
    revalidatePath("/profile");
    return { success: true, data: slots };
  } catch (err) {
    return handleErr(err, "setAvailabilityAction");
  }
}

export async function getAvailabilityAction(
  profileId: string,
): Promise<ApiResponse<TutorAvailability[]>> {
  try {
    const slots = await tutoringService.getAvailability(profileId);
    return { success: true, data: slots };
  } catch (err) {
    return handleErr(err, "getAvailabilityAction");
  }
}

/* ── Bookings ─────────────────────────────────────────────── */

export async function createBookingAction(
  input: z.input<typeof createBookingSchema>,
): Promise<ApiResponse<{ id: string; status: string; scheduledAt: Date }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    requireRole(dbUser.role, "student", "parent", "platform_admin");

    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }

    // If the booker is a parent, they must be linked to the student.
    if (dbUser.role === "parent") {
      const linked = await isParentOf(dbUser.id, parsed.data.studentId);
      if (!linked) {
        throw AppError.forbidden("Vous n'êtes pas lié à cet élève");
      }
    } else if (dbUser.role === "student") {
      if (parsed.data.studentId !== dbUser.id) {
        throw AppError.forbidden("Un élève ne peut réserver que pour lui-même");
      }
    }

    const booking = await tutoringService.createBooking(parsed.data, dbUser.id);
    logger.info("Booking created", {
      bookingId: booking.id,
      byUserId: dbUser.id,
      studentId: parsed.data.studentId,
    });
    revalidatePath("/bookings");
    revalidatePath("/dashboard");
    return {
      success: true,
      data: {
        id: booking.id,
        status: booking.status,
        scheduledAt: booking.scheduledAt,
      },
    };
  } catch (err) {
    return handleErr(err, "createBookingAction");
  }
}

export async function confirmBookingAction(
  bookingId: string,
): Promise<ApiResponse<{ id: string; status: string }>> {
  try {
    const { userId, booking } = await requireBookerOrStudent(bookingId);
    if (booking.tutorProfile.user.id !== userId) {
      throw AppError.unauthorized("Seul le tuteur peut confirmer la séance");
    }
    const updated = await tutoringService.confirmBooking(bookingId);
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    return { success: true, data: { id: updated.id, status: updated.status } };
  } catch (err) {
    return handleErr(err, "confirmBookingAction");
  }
}

export async function cancelBookingAction(
  input: z.input<typeof cancelBookingSchema>,
): Promise<ApiResponse<{ id: string; status: string }>> {
  try {
    const parsed = cancelBookingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const { booking } = await requireBookerOrStudent(parsed.data.bookingId);
    const updated = await tutoringService.cancelBooking(
      parsed.data.bookingId,
      parsed.data.reason,
    );
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${parsed.data.bookingId}`);
    return { success: true, data: { id: updated.id, status: updated.status } };
  } catch (err) {
    return handleErr(err, "cancelBookingAction");
  }
}

export async function completeBookingAction(
  bookingId: string,
): Promise<ApiResponse<{ id: string; status: string }>> {
  try {
    const { userId, booking } = await requireBookerOrStudent(bookingId);
    if (booking.tutorProfile.user.id !== userId) {
      throw AppError.unauthorized("Seul le tuteur peut terminer la séance");
    }
    const updated = await tutoringService.completeBooking(bookingId);
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/earnings");
    return { success: true, data: { id: updated.id, status: updated.status } };
  } catch (err) {
    return handleErr(err, "completeBookingAction");
  }
}

export async function rescheduleBookingAction(
  input: z.input<typeof rescheduleBookingSchema>,
): Promise<ApiResponse<{ id: string; scheduledAt: Date }>> {
  try {
    const parsed = rescheduleBookingSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const { booking } = await requireBookerOrStudent(parsed.data.bookingId);
    const updated = await tutoringService.rescheduleBooking(parsed.data);
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${parsed.data.bookingId}`);
    void booking;
    return {
      success: true,
      data: { id: updated.id, scheduledAt: updated.scheduledAt },
    };
  } catch (err) {
    return handleErr(err, "rescheduleBookingAction");
  }
}

/* ── Reviews ──────────────────────────────────────────────── */

export async function createReviewAction(
  input: z.input<typeof createReviewSchema>,
): Promise<ApiResponse<{ id: string; rating: number }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = createReviewSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const review = await tutoringService.createReview(parsed.data, dbUser.id);
    logger.info("Review created", {
      reviewId: review.id,
      bookingId: parsed.data.bookingId,
      byUserId: dbUser.id,
    });
    revalidatePath(`/tutors/${parsed.data.bookingId}`);
    return { success: true, data: { id: review.id, rating: review.rating } };
  } catch (err) {
    return handleErr(err, "createReviewAction");
  }
}

export async function moderateReviewAction(
  input: z.input<typeof moderateReviewSchema>,
): Promise<ApiResponse<{ moderated: boolean; action: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    requireRole(dbUser.role, "platform_admin", "content_moderator");
    const parsed = moderateReviewSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const result = await tutoringService.moderateReview(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "moderateReviewAction");
  }
}

/* ── Queries ──────────────────────────────────────────────── */

export async function getTutorProfileAction(): Promise<
  ApiResponse<TutorProfile | null>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const profile = await tutoringService.getTutorProfileById(dbUser.id);
    return { success: true, data: profile };
  } catch (err) {
    return handleErr(err, "getTutorProfileAction");
  }
}

export async function getTutorProfileByIdAction(
  profileId: string,
): Promise<ApiResponse<TutorProfilePublic | null>> {
  try {
    const profile = await tutoringService.getTutorProfileById(profileId);
    return { success: true, data: profile };
  } catch (err) {
    return handleErr(err, "getTutorProfileByIdAction");
  }
}

export async function listTutorsAction(
  input: z.input<typeof listTutorsQuerySchema>,
): Promise<
  ApiResponse<{
    items: TutorListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const parsed = listTutorsQuerySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const result = await tutoringService.listTutors(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listTutorsAction");
  }
}

export async function listTutorBookingsAction(
  input: z.input<typeof listTutorBookingsQuerySchema>,
): Promise<
  ApiResponse<{
    items: Array<{
      id: string;
      scheduledAt: Date;
      status: string;
      price: number;
      studentId: string;
      tutorProfileId: string;
      bookedBy: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const parsed = listTutorBookingsQuerySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    await requireTutorProfileOwner(parsed.data.tutorProfileId);
    const result = await tutoringService.listTutorBookings(parsed.data);
    return {
      success: true,
      data: {
        items: result.items.map((b) => ({
          id: b.id,
          scheduledAt: b.scheduledAt,
          status: b.status,
          price: b.price,
          studentId: b.studentId,
          tutorProfileId: b.tutorProfileId,
          bookedBy: b.bookedBy,
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    };
  } catch (err) {
    return handleErr(err, "listTutorBookingsAction");
  }
}

export async function listStudentBookingsAction(studentId: string): Promise<
  ApiResponse<
    Array<{
      id: string;
      scheduledAt: Date;
      status: string;
      price: number;
      tutorProfileId: string;
    }>
  >
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    requireRole(dbUser.role, "student", "parent", "platform_admin");
    if (dbUser.role === "parent") {
      const linked = await isParentOf(dbUser.id, studentId);
      if (!linked) throw AppError.forbidden("Vous n'êtes pas lié à cet élève");
    } else if (dbUser.role === "student" && dbUser.id !== studentId) {
      throw AppError.forbidden("Un élève ne voit que ses propres réservations");
    }
    const items = await tutoringService.listStudentBookings(studentId);
    return {
      success: true,
      data: items.map((b) => ({
        id: b.id,
        scheduledAt: b.scheduledAt,
        status: b.status,
        price: b.price,
        tutorProfileId: b.tutorProfileId,
      })),
    };
  } catch (err) {
    return handleErr(err, "listStudentBookingsAction");
  }
}

export async function listParentBookingsAction(): Promise<
  ApiResponse<
    Array<{
      id: string;
      scheduledAt: Date;
      status: string;
      price: number;
      studentId: string;
      tutorProfileId: string;
    }>
  >
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    requireRole(dbUser.role, "parent", "platform_admin");
    const items = await tutoringService.listParentBookings(dbUser.id);
    return {
      success: true,
      data: items.map((b) => ({
        id: b.id,
        scheduledAt: b.scheduledAt,
        status: b.status,
        price: b.price,
        studentId: b.studentId,
        tutorProfileId: b.tutorProfileId,
      })),
    };
  } catch (err) {
    return handleErr(err, "listParentBookingsAction");
  }
}

export async function listTutorReviewsAction(
  input: z.input<typeof listTutorReviewsQuerySchema>,
): Promise<
  ApiResponse<{
    items: ReviewWithReviewer[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const parsed = listTutorReviewsQuerySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const result = await tutoringService.listTutorReviews(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listTutorReviewsAction");
  }
}

/* ── Tutor dashboard data ─────────────────────────────────── */

export async function getTutorEarningsAction(): Promise<
  ApiResponse<TutorEarnings>
> {
  try {
    const { profileId } = await requireTutor();
    const data = await tutoringService.getTutorEarnings(profileId);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getTutorEarningsAction");
  }
}

export async function getTutorDashboardStatsAction(): Promise<
  ApiResponse<{
    profileId: string;
    upcomingCount: number;
    pendingCount: number;
    completedCount: number;
    ratingAvg: number;
    ratingCount: number;
    monthlyRevenue: number;
  }>
> {
  try {
    const { profileId } = await requireTutor();
    const db = await getDb();
    const profileRows = await db
      .select()
      .from(tutorProfiles)
      .where(eq(tutorProfiles.id, profileId))
      .limit(1);
    const profile = profileRows.at(0);
    if (!profile) throw AppError.notFound("Tutor profile not found");

    const bookings = await db
      .select({
        status: tutorBookings.status,
        scheduledAt: tutorBookings.scheduledAt,
        price: tutorBookings.price,
      })
      .from(tutorBookings)
      .where(eq(tutorBookings.tutorProfileId, profileId));
    const now = new Date();
    const upcomingCount = bookings.filter(
      (b) => b.status === "confirmed" && b.scheduledAt >= now,
    ).length;
    const pendingCount = bookings.filter((b) => b.status === "pending").length;
    const completed = bookings.filter((b) => b.status === "completed");
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = completed
      .filter((b) => b.scheduledAt >= startOfMonth)
      .reduce((acc, b) => acc + (b.price ?? 0), 0);
    const ratingAvg =
      typeof profile.ratingAvg === "string"
        ? parseFloat(profile.ratingAvg) || 0
        : Number(profile.ratingAvg ?? 0);

    return {
      success: true,
      data: {
        profileId,
        upcomingCount,
        pendingCount,
        completedCount: completed.length,
        ratingAvg,
        ratingCount: profile.ratingCount,
        monthlyRevenue,
      },
    };
  } catch (err) {
    return handleErr(err, "getTutorDashboardStatsAction");
  }
}
