/**
 * §5.14 — Parent module validators (Zod v4).
 *
 * Inputs for parent↔child linking and parent-side data queries.
 */

import { z } from "zod";

/**
 * Link a parent to a student. The "student code" is the student's
 * email address (the unique identifier parents receive from their
 * child's school). Optionally a custom relationship label can be set.
 */
export const linkChildSchema = z.object({
  /** Email address of the student to link. */
  studentEmail: z.email("Adresse e-mail de l'élève invalide"),
  relationship: z
    .enum(["parent", "guardian", "sibling", "other"])
    .default("parent"),
});

/**
 * Unlink a parent from a student (requires consent re-validation client-side).
 */
export const unlinkChildSchema = z.object({
  studentId: z.uuid(),
});

/**
 * Resolve a student id (used by every getChildXxx query).
 */
export const childIdSchema = z.object({
  studentId: z.uuid(),
});

/**
 * Optional limit for timeline / recent items.
 */
export const childTimelineQuerySchema = z.object({
  studentId: z.uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LinkChildInput = z.infer<typeof linkChildSchema>;
export type UnlinkChildInput = z.infer<typeof unlinkChildSchema>;
export type ChildIdInput = z.infer<typeof childIdSchema>;
export type ChildTimelineQuery = z.infer<typeof childTimelineQuerySchema>;
