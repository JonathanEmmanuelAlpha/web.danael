/**
 * §10.3 — Assignments, submissions, grades & attendance.
 *
 * - assignments (homework / exam given by a teacher to a class)
 * - assignment_items (ordered list of resources/files/quizzes attached)
 * - submissions (one per student per assignment)
 * - submission_files (uploaded files attached to a submission)
 * - grades (broader gradebook entry — also covers non-assignment grades)
 * - attendance (daily attendance per student per class)
 */
import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean,
  integer as pgInteger,
  numeric,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { pgRef } from "./_env";
import { users } from "./users";
import { classes, subjects } from "./schools";
import { files, contents } from "./contents";
import {
  assignmentStatusEnum,
  submissionStatusEnum,
  attendanceStatusEnum,
  assignmentItemTypeEnum,
  gradePeriodEnum,
} from "./enums";

/* ─────────────────────────────────────────────────────────────
 * assignments
 * ──────────────────────────────────────────────────────────── */

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: pgText("title").notNull(),
    description: pgText("description"),
    classId: uuid("class_id")
      .notNull()
      .references(() => pgRef(classes.id), { onDelete: "cascade" }),
    subjectId: uuid("subject_id").references(() => pgRef(subjects.id), {
      onDelete: "set null",
    }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    points: pgInteger("points"),
    allowLateSubmission: boolean("allow_late_submission")
      .default(false)
      .notNull(),
    status: assignmentStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    classIdx: pgIndex("assignments_class_id_idx").on(t.classId),
    subjectIdx: pgIndex("assignments_subject_id_idx").on(t.subjectId),
    teacherIdx: pgIndex("assignments_teacher_id_idx").on(t.teacherId),
    statusIdx: pgIndex("assignments_status_idx").on(t.status),
    dueIdx: pgIndex("assignments_due_at_idx").on(t.dueAt),
  }),
);

export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * assignment_items — ordered resources attached to an assignment
 * ──────────────────────────────────────────────────────────── */

export const assignmentItems = pgTable(
  "assignment_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => pgRef(assignments.id), { onDelete: "cascade" }),
    type: assignmentItemTypeEnum("type").notNull().default("content"),
    contentId: uuid("content_id").references(() => pgRef(contents.id), {
      onDelete: "set null",
    }),
    url: pgText("url"),
    position: pgInteger("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    assignmentIdx: pgIndex("assignment_items_assignment_id_idx").on(
      t.assignmentId,
    ),
    contentIdx: pgIndex("assignment_items_content_id_idx").on(t.contentId),
  }),
);

export type AssignmentItem = typeof assignmentItems.$inferSelect;
export type NewAssignmentItem = typeof assignmentItems.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * submissions
 * ──────────────────────────────────────────────────────────── */

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => pgRef(assignments.id), { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    status: submissionStatusEnum("status").notNull().default("not_started"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    score: numeric("score", { precision: 6, scale: 2 }),
    feedback: pgText("feedback"),
    gradedBy: uuid("graded_by").references(() => pgRef(users.id), {
      onDelete: "set null",
    }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    assignStudentIdx: pgUniqueIndex("submissions_assignment_student_uniq").on(
      t.assignmentId,
      t.studentId,
    ),
    studentIdx: pgIndex("submissions_student_id_idx").on(t.studentId),
    statusIdx: pgIndex("submissions_status_idx").on(t.status),
  }),
);

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * submission_files
 * ──────────────────────────────────────────────────────────── */

export const submissionFiles = pgTable(
  "submission_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => pgRef(submissions.id), { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => pgRef(files.id), { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    submissionIdx: pgIndex("submission_files_submission_id_idx").on(
      t.submissionId,
    ),
    fileIdx: pgIndex("submission_files_file_id_idx").on(t.fileId),
  }),
);

export type SubmissionFile = typeof submissionFiles.$inferSelect;
export type NewSubmissionFile = typeof submissionFiles.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * grades — gradebook entries
 * ──────────────────────────────────────────────────────────── */

export const grades = pgTable(
  "grades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => pgRef(classes.id), {
      onDelete: "cascade",
    }),
    subjectId: uuid("subject_id").references(() => pgRef(subjects.id), {
      onDelete: "set null",
    }),
    assignmentId: uuid("assignment_id").references(
      () => pgRef(assignments.id),
      {
        onDelete: "set null",
      },
    ),
    score: numeric("score", { precision: 6, scale: 2 }).notNull(),
    maxScore: numeric("max_score", { precision: 6, scale: 2 })
      .notNull()
      .default("20"),
    period: gradePeriodEnum("period").notNull().default("T1"),
    comment: pgText("comment"),
    gradedBy: uuid("graded_by")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("grades_student_id_idx").on(t.studentId),
    classIdx: pgIndex("grades_class_id_idx").on(t.classId),
    subjectIdx: pgIndex("grades_subject_id_idx").on(t.subjectId),
    assignmentIdx: pgIndex("grades_assignment_id_idx").on(t.assignmentId),
    periodIdx: pgIndex("grades_period_idx").on(t.period),
  }),
);

export type Grade = typeof grades.$inferSelect;
export type NewGrade = typeof grades.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * attendance
 * ──────────────────────────────────────────────────────────── */

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => pgRef(classes.id), { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Calendar day (no timezone) the record applies to. */
    date: timestamp("date", { withTimezone: true }).notNull(),
    status: attendanceStatusEnum("status").notNull().default("present"),
    reason: pgText("reason"),
    recordedBy: uuid("recorded_by").references(() => pgRef(users.id), {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    classIdx: pgIndex("attendance_class_id_idx").on(t.classId),
    studentIdx: pgIndex("attendance_student_id_idx").on(t.studentId),
    dateIdx: pgIndex("attendance_date_idx").on(t.date),
    classStudentDateIdx: pgIndex("attendance_class_student_date_idx").on(
      t.classId,
      t.studentId,
      t.date,
    ),
  }),
);

export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;
