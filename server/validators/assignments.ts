/**
 * §5.5 — Assignment validators (Zod v4).
 *
 * Covers assignments, assignment_items, submissions and grading.
 */

import { z } from "zod";

import {
  ASSIGNMENT_STATUS_VALUES,
  SUBMISSION_STATUS_VALUES,
  ASSIGNMENT_ITEM_TYPE_VALUES,
} from "@/server/db/schema/enums";

/* ── Assignment items ──────────────────────────────────────── */

/**
 * A single resource attached to an assignment (file/url/text/quiz).
 * `text` is stored in the `url` column (kept as a generic payload for now).
 */
export const assignmentItemSchema = z
  .object({
    type: z.enum(ASSIGNMENT_ITEM_TYPE_VALUES).default("content"),
    contentId: z.uuid().optional(),
    url: z.string().max(2048).optional(),
    text: z.string().max(8000).optional(),
    position: z.number().int().min(0).default(0),
  })
  .refine(
    (v) => v.type !== "url" || (!!v.url && v.url.length > 0),
    { message: "URL required for url items", path: ["url"] },
  )
  .refine(
    (v) => v.type !== "text" || (!!v.text && v.text.length > 0),
    { message: "Text required for text items", path: ["text"] },
  );

export type AssignmentItemInput = z.infer<typeof assignmentItemSchema>;

/* ── Assignment ────────────────────────────────────────────── */

/**
 * Create an assignment (with optional items).
 */
export const createAssignmentSchema = z.object({
  title: z.string().min(2, "Title too short").max(200),
  description: z.string().max(5000).optional(),
  classId: z.uuid(),
  subjectId: z.uuid().optional(),
  /** `teacherId` is resolved server-side but accepted for parity. */
  teacherId: z.uuid(),
  dueAt: z.iso.datetime().optional(),
  points: z.number().int().min(0).max(1000).optional(),
  allowLateSubmission: z.boolean().default(false),
  status: z.enum(ASSIGNMENT_STATUS_VALUES).default("draft"),
  items: z.array(assignmentItemSchema).max(20).default([]),
});

/**
 * Update an assignment.
 */
export const updateAssignmentSchema = z.object({
  id: z.uuid(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  classId: z.uuid().optional(),
  subjectId: z.uuid().nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  points: z.number().int().min(0).max(1000).nullable().optional(),
  allowLateSubmission: z.boolean().optional(),
  status: z.enum(ASSIGNMENT_STATUS_VALUES).optional(),
});

/**
 * Paginated / filtered listing of assignments.
 */
export const listAssignmentsQuerySchema = z.object({
  classId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
  studentId: z.uuid().optional(),
  status: z.enum(ASSIGNMENT_STATUS_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/* ── Submissions ──────────────────────────────────────────── */

/**
 * Submit an assignment (student side) — attaches files & optional text answer.
 */
export const submitAssignmentSchema = z.object({
  assignmentId: z.uuid(),
  /** `studentId` is resolved server-side but accepted for parity. */
  studentId: z.uuid(),
  /** Optional comment / text answer provided by the student. */
  comment: z.string().max(5000).optional(),
  fileIds: z.array(z.uuid()).max(10).default([]),
});

/**
 * Re-submit (update before deadline). Same shape as submit.
 */
export const resubmitAssignmentSchema = z.object({
  submissionId: z.uuid(),
  comment: z.string().max(5000).nullable().optional(),
  fileIds: z.array(z.uuid()).max(10).default([]),
});

/* ── Grading ───────────────────────────────────────────────── */

/**
 * Grade a submission (teacher side).
 */
export const gradeSubmissionSchema = z.object({
  id: z.uuid(),
  score: z.number().min(0).max(100),
  feedback: z.string().max(5000).optional(),
  /** `gradedBy` is resolved server-side but accepted for parity. */
  gradedBy: z.uuid(),
  status: z.enum(["graded", "returned"]).default("graded"),
});

/* ── Standalone item add ──────────────────────────────────── */

/**
 * Add an ordered resource item to an assignment (kept for parity with the
 * service-layer API).
 */
export const addAssignmentItemSchema = z.object({
  assignmentId: z.uuid(),
  type: z.enum(ASSIGNMENT_ITEM_TYPE_VALUES).default("content"),
  contentId: z.uuid().optional(),
  url: z.string().max(2048).optional(),
  text: z.string().max(8000).optional(),
  position: z.number().int().min(0).default(0),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type ResubmitAssignmentInput = z.infer<typeof resubmitAssignmentSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type AddAssignmentItemInput = z.infer<typeof addAssignmentItemSchema>;
