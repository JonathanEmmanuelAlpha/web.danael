/**
 * §5.8 — Gamification validators (Zod v4).
 *
 * XP, levels, streaks, weekly goals, activities.
 */

import { z } from "zod";

import {
  GOAL_TYPE_VALUES,
  GOAL_PERIOD_VALUES,
  GOAL_STATUS_VALUES,
} from "@/server/db/schema/enums";

/**
 * Award XP — used internally and by server actions (quiz completion, content
 * view, etc.). Reason is a free-form short string (max 200 chars).
 */
export const awardXpSchema = z.object({
  amount: z.number().int().min(1).max(100_000),
  reason: z.string().min(2).max(200),
});

export type AwardXpInput = z.infer<typeof awardXpSchema>;

/**
 * Create a weekly / monthly goal.
 */
export const createWeeklyGoalSchema = z.object({
  type: z.enum(GOAL_TYPE_VALUES),
  targetValue: z.number().int().min(1).max(10_000),
  period: z.enum(GOAL_PERIOD_VALUES).default("weekly"),
});

export type CreateWeeklyGoalInput = z.infer<typeof createWeeklyGoalSchema>;

/**
 * Update a goal's progress (incremental).
 */
export const updateGoalProgressSchema = z.object({
  goalId: z.uuid(),
  increment: z.number().int().min(0).max(10_000).default(1),
});

export type UpdateGoalProgressInput = z.infer<typeof updateGoalProgressSchema>;

/**
 * List goals with optional status filter.
 */
export const listUserGoalsQuerySchema = z.object({
  status: z.enum(GOAL_STATUS_VALUES).optional(),
  period: z.enum(GOAL_PERIOD_VALUES).optional(),
});

export type ListUserGoalsQuery = z.infer<typeof listUserGoalsQuerySchema>;

/**
 * Leaderboard scope (which pool of users to compare against).
 */
export const leaderboardQuerySchema = z.object({
  scope: z.enum(["class", "school", "regional", "national", "global"]).default("global"),
  /** Optionally filter by level (e.g. only 6e students). */
  level: z.string().max(20).optional(),
  /** Limit (default 50, max 200). */
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

/**
 * Log an activity (server-side, after a meaningful user action).
 */
export const logActivitySchema = z.object({
  type: z.enum([
    "view_content",
    "download_content",
    "submit_assignment",
    "complete_quiz",
    "earn_badge",
    "join_class",
    "post_message",
    "rate_content",
  ]),
  entityType: z.string().min(1).max(80),
  entityId: z.string().min(1).max(120),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LogActivityInput = z.infer<typeof logActivitySchema>;
