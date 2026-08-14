/**
 * §10.3 — Subject & class-subject validators (Zod v4).
 */

import { z } from "zod";

/**
 * Create a subject in the global catalog (admin / school_admin).
 */
export const createSubjectSchema = z.object({
  name: z.string().min(2, "Name too short").max(120),
  code: z
    .string()
    .min(2, "Code too short")
    .max(40)
    .regex(/^[A-Z0-9_-]+$/i, "Use letters, digits, dashes or underscores only"),
  description: z.string().max(2000).optional(),
});

/**
 * Update a subject.
 */
export const updateSubjectSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(120).optional(),
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/i)
    .optional(),
  description: z.string().max(2000).nullable().optional(),
});

/**
 * Assign a subject to a class with a coefficient and optional teacher.
 */
export const assignSubjectSchema = z.object({
  classId: z.uuid(),
  subjectId: z.uuid(),
  coefficient: z.number().int().min(1).max(20).default(1),
  teacherId: z.uuid().nullable().optional(),
});

/**
 * Update an existing class_subject row (coefficient / teacher).
 */
export const updateClassSubjectSchema = z.object({
  id: z.uuid(),
  coefficient: z.number().int().min(1).max(20).optional(),
  teacherId: z.uuid().nullable().optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type AssignSubjectInput = z.infer<typeof assignSubjectSchema>;
export type UpdateClassSubjectInput = z.infer<typeof updateClassSubjectSchema>;
