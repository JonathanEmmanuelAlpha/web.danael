/**
 * §10.3 — Class validators (Zod v4).
 */

import { z } from "zod";

import {
  LEVEL_VALUES,
  SERIES_VALUES,
  ROLE_IN_SCHOOL_VALUES,
} from "@/server/db/schema/enums";

/**
 * Create a new class within a school.
 */
export const createClassSchema = z.object({
  schoolId: z.uuid(),
  name: z.string().min(1, "Name required").max(120),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Use format YYYY-YYYY (e.g. 2025-2026)")
    .optional(),
  headTeacherId: z.uuid().optional(),
  /** Optional explicit invite code; auto-generated if omitted. */
  inviteCode: z.string().min(4).max(32).optional(),
});

/**
 * Student / teacher / parent self-join via invite code.
 */
export const joinClassSchema = z.object({
  inviteCode: z.string().min(4, "Invite code too short").max(32),
  /** Optional override of role (defaults to "student"). */
  role: z.enum(ROLE_IN_SCHOOL_VALUES).default("student"),
});

/**
 * Update a class — used by school admins / head teachers.
 */
export const updateClassSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120).optional(),
  level: z.enum(LEVEL_VALUES).nullable().optional(),
  series: z.enum(SERIES_VALUES).nullable().optional(),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Use format YYYY-YYYY (e.g. 2025-2026)")
    .nullable()
    .optional(),
  headTeacherId: z.uuid().nullable().optional(),
  inviteCode: z.string().min(4).max(32).optional(),
});

/**
 * Paginated / filtered listing of classes.
 */
export const listClassesQuerySchema = z.object({
  schoolId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
  studentId: z.uuid().optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  academicYear: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type JoinClassInput = z.infer<typeof joinClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
