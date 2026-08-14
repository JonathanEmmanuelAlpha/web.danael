/**
 * §5.16 — Admin validators (Zod v4).
 *
 * Used by the admin server actions to validate every input. Mirrors the DB
 * schema enums (see src/server/db/schema/enums.ts).
 */

import { z } from "zod";

import {
  USER_ROLE_VALUES,
  REPORT_STATUS_VALUES,
  CONTENT_VISIBILITY_VALUES,
  PUBLICATION_STATUS_VALUES,
  SUBSCRIPTION_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  PAYMENT_PROVIDER_VALUES,
} from "@/server/db/schema/enums";

/* ── Users ──────────────────────────────────────────────────── */

export const listUsersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  role: z.enum(USER_ROLE_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const getUserByIdSchema = z.object({
  id: z.uuid(),
});

export const updateUserRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(USER_ROLE_VALUES),
});

export const deactivateUserSchema = z.object({
  userId: z.uuid(),
});

/* ── Schools ────────────────────────────────────────────────── */

export const listAdminSchoolsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  isVerified: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const verifySchoolSchema = z.object({
  schoolId: z.uuid(),
  verified: z.boolean().default(true),
});

/* ── Contents ───────────────────────────────────────────────── */

export const listContentsAdminQuerySchema = z.object({
  search: z.string().max(200).optional(),
  visibility: z.enum(CONTENT_VISIBILITY_VALUES).optional(),
  publicationStatus: z.enum(PUBLICATION_STATUS_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const removeContentSchema = z.object({
  contentId: z.uuid(),
});

/* ── Subscriptions / Payments ──────────────────────────────── */

export const listAdminSubscriptionsQuerySchema = z.object({
  status: z.enum(SUBSCRIPTION_STATUS_VALUES).optional(),
  userId: z.uuid().optional(),
  schoolId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listAdminPaymentsQuerySchema = z.object({
  status: z.enum(PAYMENT_STATUS_VALUES).optional(),
  provider: z.enum(PAYMENT_PROVIDER_VALUES).optional(),
  subscriptionId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/* ── Moderation ─────────────────────────────────────────────── */

export const moderationTargetTypes = [
  "content",
  "message",
  "user",
  "review",
  "testimony",
] as const;
export type ModerationTargetType = (typeof moderationTargetTypes)[number];

export const createReportSchema = z.object({
  targetType: z.enum(moderationTargetTypes),
  targetId: z.string().min(1).max(200),
  reason: z.string().min(3, "Reason too short").max(500),
});

export const listReportsQuerySchema = z.object({
  status: z.enum(REPORT_STATUS_VALUES).optional(),
  targetType: z.enum(moderationTargetTypes).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const getReportSchema = z.object({
  id: z.uuid(),
});

export const resolveReportSchema = z.object({
  id: z.uuid(),
  action: z.enum(["approved", "removed", "warning"]),
});

export const dismissReportSchema = z.object({
  id: z.uuid(),
});

export const removeMessageSchema = z.object({
  messageId: z.uuid(),
});

/* ── Audit ──────────────────────────────────────────────────── */

export const listAuditLogsQuerySchema = z.object({
  actorId: z.uuid().optional(),
  action: z.string().max(100).optional(),
  entityType: z.string().max(100).optional(),
  /** ISO date string (start of range). */
  from: z.iso.datetime().optional(),
  /** ISO date string (end of range). */
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const getAuditLogSchema = z.object({
  id: z.uuid(),
});

/* ── Feature flags ──────────────────────────────────────────── */

export const createFlagSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9._-]+$/, "Key must be lowercase, digits, dots, dashes"),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(false),
});

export const setFlagSchema = z.object({
  key: z.string().min(1).max(120),
  enabled: z.boolean(),
});

export const getFlagSchema = z.object({
  key: z.string().min(1).max(120),
});

/* ── Inferred types ────────────────────────────────────────── */

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type GetUserByIdInput = z.infer<typeof getUserByIdSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;
export type ListAdminSchoolsQuery = z.infer<typeof listAdminSchoolsQuerySchema>;
export type VerifySchoolInput = z.infer<typeof verifySchoolSchema>;
export type ListContentsAdminQuery = z.infer<typeof listContentsAdminQuerySchema>;
export type RemoveContentInput = z.infer<typeof removeContentSchema>;
export type ListAdminSubscriptionsQuery = z.infer<
  typeof listAdminSubscriptionsQuerySchema
>;
export type ListAdminPaymentsQuery = z.infer<typeof listAdminPaymentsQuerySchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type GetReportInput = z.infer<typeof getReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type DismissReportInput = z.infer<typeof dismissReportSchema>;
export type RemoveMessageInput = z.infer<typeof removeMessageSchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type GetAuditLogInput = z.infer<typeof getAuditLogSchema>;
export type CreateFlagInput = z.infer<typeof createFlagSchema>;
export type SetFlagInput = z.infer<typeof setFlagSchema>;
export type GetFlagInput = z.infer<typeof getFlagSchema>;
