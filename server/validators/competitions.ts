/**
 * §5.7 + §5.8 — Competitions validators (Zod v4).
 */

import { z } from "zod";

import {
  COMPETITION_SCOPE_VALUES,
  COMPETITION_STATUS_VALUES,
  LEVEL_VALUES,
  SERIES_VALUES,
} from "@/server/db/schema/enums";

/**
 * Create a competition. `creatorId` is injected by the server action.
 */
export const createCompetitionSchema = z.object({
  title: z.string().min(2, "Title too short").max(200),
  description: z.string().max(2000).optional(),
  scope: z.enum(COMPETITION_SCOPE_VALUES).default("class"),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  schoolId: z.uuid().optional(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  prizeDescription: z.string().max(1000).optional(),
}).refine((data) => new Date(data.endAt) > new Date(data.startAt), {
  message: "End date must be after start date",
  path: ["endAt"],
});

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;

/**
 * Update a competition — all editable fields optional except id.
 */
export const updateCompetitionSchema = z.object({
  id: z.uuid(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  scope: z.enum(COMPETITION_SCOPE_VALUES).optional(),
  level: z.enum(LEVEL_VALUES).nullable().optional(),
  series: z.enum(SERIES_VALUES).nullable().optional(),
  schoolId: z.uuid().nullable().optional(),
  startAt: z.iso.datetime().optional(),
  endAt: z.iso.datetime().optional(),
  status: z.enum(COMPETITION_STATUS_VALUES).optional(),
  prizeDescription: z.string().max(1000).nullable().optional(),
});

export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>;

/**
 * List competitions with filters (scope, status, level, series, schoolId).
 */
export const listCompetitionsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  scope: z.enum(COMPETITION_SCOPE_VALUES).optional(),
  status: z.enum(COMPETITION_STATUS_VALUES).optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  schoolId: z.uuid().optional(),
  userId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListCompetitionsQuery = z.infer<
  typeof listCompetitionsQuerySchema
>;

/**
 * Join a competition. `userId` is injected by the server action.
 */
export const joinCompetitionSchema = z.object({
  competitionId: z.uuid(),
  isAnonymous: z.boolean().default(false),
});

export type JoinCompetitionInput = z.infer<typeof joinCompetitionSchema>;

/**
 * Submit / update a competition score.
 */
export const submitCompetitionScoreSchema = z.object({
  competitionId: z.uuid(),
  score: z.number().int().min(0).max(1_000_000),
});

export type SubmitCompetitionScoreInput = z.infer<
  typeof submitCompetitionScoreSchema
>;
