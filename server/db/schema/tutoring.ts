/**
 * §10.3 — Tutoring marketplace.
 *
 * - tutor_profiles (verified tutors with rating + hourly rate)
 * - tutor_subjects (subjects a tutor teaches, scoped by level)
 * - tutor_availabilities (recurring weekly slots)
 * - tutor_bookings (session requests)
 * - tutor_reviews (post-session feedback)
 */

import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean as pgBoolean,
  integer as pgInteger,
  numeric,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { pgRef } from "./_env";
import { users } from "./users";
import { subjects } from "./schools";
import { levelEnum, tutorBookingStatusEnum } from "./enums";

/* -------------------------------------------------------------
 * tutor_profiles
 * ------------------------------------------------------------ */

export const tutorProfiles = pgTable(
  "tutor_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    bio: pgText("bio"),
    /** Hourly rate in smallest currency unit (XOF). */
    hourlyRate: pgInteger("hourly_rate"),
    /** Geographic location / city. */
    location: pgText("location"),
    isVerified: pgBoolean("is_verified").default(false).notNull(),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).default("0"),
    ratingCount: pgInteger("rating_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    userIdx: pgUniqueIndex("tutor_profiles_user_id_uniq").on(t.userId),
    verifiedIdx: pgIndex("tutor_profiles_is_verified_idx").on(t.isVerified),
  }),
);

export type TutorProfile = typeof tutorProfiles.$inferSelect;
export type NewTutorProfile = typeof tutorProfiles.$inferInsert;

/* -------------------------------------------------------------
 * tutor_subjects
 * ------------------------------------------------------------ */

export const tutorSubjects = pgTable(
  "tutor_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tutorProfileId: uuid("tutor_profile_id")
      .notNull()
      .references(() => pgRef(tutorProfiles.id), { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => pgRef(subjects.id), { onDelete: "cascade" }),
    level: levelEnum("level"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    tutorIdx: pgIndex("tutor_subjects_tutor_profile_id_idx").on(
      t.tutorProfileId,
    ),
    subjectIdx: pgIndex("tutor_subjects_subject_id_idx").on(t.subjectId),
    levelIdx: pgIndex("tutor_subjects_level_idx").on(t.level),
  }),
);

export type TutorSubject = typeof tutorSubjects.$inferSelect;
export type NewTutorSubject = typeof tutorSubjects.$inferInsert;

/* -------------------------------------------------------------
 * tutor_availabilities — recurring weekly slots
 * ------------------------------------------------------------ */

export const tutorAvailabilities = pgTable(
  "tutor_availabilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tutorProfileId: uuid("tutor_profile_id")
      .notNull()
      .references(() => pgRef(tutorProfiles.id), { onDelete: "cascade" }),
    /** Day of week: 0 = Sunday … 6 = Saturday. */
    dayOfWeek: pgInteger("day_of_week").notNull(),
    /** Start time "HH:MM" (24h). */
    startTime: pgText("start_time").notNull(),
    endTime: pgText("end_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    tutorIdx: pgIndex("tutor_availabilities_tutor_profile_id_idx").on(
      t.tutorProfileId,
    ),
    dayIdx: pgIndex("tutor_availabilities_day_of_week_idx").on(t.dayOfWeek),
  }),
);

export type TutorAvailability = typeof tutorAvailabilities.$inferSelect;
export type NewTutorAvailability = typeof tutorAvailabilities.$inferInsert;

/* -------------------------------------------------------------
 * tutor_bookings
 * ------------------------------------------------------------ */

export const tutorBookings = pgTable(
  "tutor_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tutorProfileId: uuid("tutor_profile_id")
      .notNull()
      .references(() => pgRef(tutorProfiles.id), { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** User who performed the booking (student themselves or a parent). */
    bookedBy: uuid("booked_by")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: tutorBookingStatusEnum("status").notNull().default("pending"),
    /** Agreed price (XOF) — captured at booking time. */
    price: pgInteger("price").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    tutorIdx: pgIndex("tutor_bookings_tutor_profile_id_idx").on(
      t.tutorProfileId,
    ),
    studentIdx: pgIndex("tutor_bookings_student_id_idx").on(t.studentId),
    statusIdx: pgIndex("tutor_bookings_status_idx").on(t.status),
    scheduledIdx: pgIndex("tutor_bookings_scheduled_at_idx").on(t.scheduledAt),
  }),
);

export type TutorBooking = typeof tutorBookings.$inferSelect;
export type NewTutorBooking = typeof tutorBookings.$inferInsert;

/* -------------------------------------------------------------
 * tutor_reviews
 * ------------------------------------------------------------ */

export const tutorReviews = pgTable(
  "tutor_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => pgRef(tutorBookings.id), { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Rating out of 5 (1..5). */
    rating: pgInteger("rating").notNull(),
    comment: pgText("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    bookingIdx: pgUniqueIndex("tutor_reviews_booking_id_uniq").on(t.bookingId),
    reviewerIdx: pgIndex("tutor_reviews_reviewer_id_idx").on(t.reviewerId),
    ratingIdx: pgIndex("tutor_reviews_rating_idx").on(t.rating),
  }),
);

export type TutorReview = typeof tutorReviews.$inferSelect;
export type NewTutorReview = typeof tutorReviews.$inferInsert;
