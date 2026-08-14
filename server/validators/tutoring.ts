/**
 * §5.15 — Tutoring marketplace validators (Zod v4).
 *
 * Inputs for tutor profile management, availabilities, bookings & reviews.
 */

import { z } from "zod";

import { LEVEL_VALUES } from "@/server/db/schema/enums";

/* ── Tutor profile ───────────────────────────────────────────── */

export const createTutorProfileSchema = z.object({
  bio: z.string().min(20, "Bio trop courte (20 caractères min)").max(2000),
  hourlyRate: z.number().int().min(0, "Le tarif ne peut pas être négatif"),
  location: z.string().min(1).max(200).optional(),
});

export const updateTutorProfileSchema = z.object({
  bio: z.string().min(20).max(2000).optional(),
  hourlyRate: z.number().int().min(0).optional(),
  location: z.string().min(1).max(200).nullable().optional(),
});

export const addTutorSubjectSchema = z.object({
  profileId: z.uuid(),
  subjectId: z.uuid(),
  level: z.enum(LEVEL_VALUES).optional(),
});

export const removeTutorSubjectSchema = z.object({
  profileId: z.uuid(),
  subjectId: z.uuid(),
});

/* ── Availabilities ─────────────────────────────────────────── */

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const availabilitySlotSchema = z.object({
  /** Day of week: 0 = Sunday … 6 = Saturday. */
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, "Format HH:MM requis"),
  endTime: z.string().regex(timeRegex, "Format HH:MM requis"),
});

export const setAvailabilitySchema = z.object({
  profileId: z.uuid(),
  slots: z.array(availabilitySlotSchema).max(50),
});

/* ── Bookings ───────────────────────────────────────────────── */

export const createBookingSchema = z.object({
  tutorProfileId: z.uuid(),
  /** Student for whom the session is booked. */
  studentId: z.uuid(),
  scheduledAt: z.iso.datetime(),
  /** Agreed price in XOF; if omitted, tutor's hourlyRate is used. */
  price: z.number().int().min(0).optional(),
});

export const rescheduleBookingSchema = z.object({
  bookingId: z.uuid(),
  newDateTime: z.iso.datetime(),
});

export const cancelBookingSchema = z.object({
  bookingId: z.uuid(),
  reason: z.string().max(500).optional(),
});

export const bookingIdSchema = z.object({
  bookingId: z.uuid(),
});

/* ── Reviews ─────────────────────────────────────────────────── */

export const createReviewSchema = z.object({
  bookingId: z.uuid(),
  rating: z.number().int().min(1, "Note minimale : 1").max(5, "Note maximale : 5"),
  comment: z.string().max(2000).optional(),
});

export const moderateReviewSchema = z.object({
  reviewId: z.uuid(),
  action: z.enum(["approve", "hide"]),
});

/* ── Search / list ───────────────────────────────────────────── */

export const listTutorsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  subjectId: z.uuid().optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxRate: z.coerce.number().int().min(0).optional(),
  location: z.string().max(200).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const listTutorBookingsQuerySchema = z.object({
  tutorProfileId: z.uuid(),
  status: z
    .enum(["pending", "confirmed", "completed", "cancelled", "no_show"])
    .optional(),
  upcoming: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const listTutorReviewsQuerySchema = z.object({
  tutorProfileId: z.uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

/* ── Exported input types ────────────────────────────────────── */

export type CreateTutorProfileInput = z.infer<typeof createTutorProfileSchema>;
export type UpdateTutorProfileInput = z.infer<typeof updateTutorProfileSchema>;
export type AddTutorSubjectInput = z.infer<typeof addTutorSubjectSchema>;
export type RemoveTutorSubjectInput = z.infer<typeof removeTutorSubjectSchema>;
export type AvailabilitySlotInput = z.infer<typeof availabilitySlotSchema>;
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
export type ListTutorsQuery = z.infer<typeof listTutorsQuerySchema>;
export type ListTutorBookingsQuery = z.infer<typeof listTutorBookingsQuerySchema>;
export type ListTutorReviewsQuery = z.infer<typeof listTutorReviewsQuerySchema>;
