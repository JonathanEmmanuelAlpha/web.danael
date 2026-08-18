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

/* ────────────────────────────────────────────────────────────────
 * Subject skills — granular competencies attached to a subject.
 * A skill is the atomic targeting unit for contents, assignments,
 * quizzes and quiz_questions.
 * ──────────────────────────────────────────────────────────────── */

export const SKILL_DIFFICULTY_VALUES = [
  "easy",
  "medium",
  "advanced",
  "hard",
] as const;
export type SkillDifficultyValue = (typeof SKILL_DIFFICULTY_VALUES)[number];

export const createSubjectSkillSchema = z.object({
  subjectId: z.uuid(),
  name: z.string().min(2, "Name too short").max(120),
  description: z.string().max(2000).optional(),
  difficulty: z.enum(SKILL_DIFFICULTY_VALUES).default("medium"),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and dashes only")
    .optional(),
  icon: z.string().max(80).optional(),
  color: z.string().max(40).optional(),
  skillNodeId: z.uuid().optional(),
  position: z.number().int().min(0).max(10000).optional(),
});

export const updateSubjectSkillSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  difficulty: z.enum(SKILL_DIFFICULTY_VALUES).optional(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  icon: z.string().max(80).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  skillNodeId: z.uuid().nullable().optional(),
  position: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

export const listSubjectSkillsSchema = z.object({
  subjectId: z.uuid(),
  includeInactive: z.boolean().default(false),
});

export type CreateSubjectSkillInput = z.infer<typeof createSubjectSkillSchema>;
export type UpdateSubjectSkillInput = z.infer<typeof updateSubjectSkillSchema>;
export type ListSubjectSkillsInput = z.infer<typeof listSubjectSkillsSchema>;
