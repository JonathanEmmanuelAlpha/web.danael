/**
 * §10.3 — School & member validators (Zod v4).
 */

import { z } from "zod";

import {
  SCHOOL_TYPE_VALUES,
  ROLE_IN_SCHOOL_VALUES,
} from "@/server/db/schema/enums";

/**
 * Create a new school. `slug` is auto-derived if not provided.
 */
export const createSchoolSchema = z.object({
  clerkOrgId: z.string().max(255).optional(),
  name: z.string().min(2, "Name too short").max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase, digits and dashes only")
    .optional(),
  type: z.enum(SCHOOL_TYPE_VALUES).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  logoUrl: z.url().optional(),
  contactEmail: z.email().optional(),
  contactPhone: z.string().max(40).optional(),
});

/**
 * Invite a user into a school.
 */
export const inviteMemberSchema = z.object({
  schoolId: z.uuid(),
  userId: z.uuid(),
  roleInSchool: z.enum(ROLE_IN_SCHOOL_VALUES),
  invitedBy: z.uuid().optional(),
});

/**
 * Update a school's editable fields.
 */
export const updateSchoolSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase, digits and dashes only")
    .optional(),
  type: z.enum(SCHOOL_TYPE_VALUES).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  logoUrl: z.url().nullable().optional(),
  contactEmail: z.email().nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  isVerified: z.boolean().optional(),
});

/**
 * Paginated / filtered listing of schools.
 */
export const listSchoolsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  type: z.enum(SCHOOL_TYPE_VALUES).optional(),
  city: z.string().max(120).optional(),
  isVerified: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Invite by email — creates a pending membership for the matching user,
 * or simply records the email so we can match it later when the user signs up.
 */
export const inviteByEmailSchema = z.object({
  schoolId: z.uuid(),
  email: z.email(),
  roleInSchool: z.enum(ROLE_IN_SCHOOL_VALUES),
});

/**
 * Update an existing membership (change role / status).
 */
export const updateMemberSchema = z.object({
  id: z.uuid(),
  roleInSchool: z.enum(ROLE_IN_SCHOOL_VALUES).optional(),
  status: z.enum(["pending", "active", "revoked"]).optional(),
  joinedAt: z.iso.datetime().optional(),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
export type ListSchoolsQuery = z.infer<typeof listSchoolsQuerySchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
