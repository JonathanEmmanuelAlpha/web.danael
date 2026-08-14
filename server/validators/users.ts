/**
 * §10.3 — User validators (Zod v4).
 *
 * Used by server actions & TanStack Form (Standard Schema).
 */

import { z } from "zod";

import {
  USER_ROLE_VALUES,
  LEVEL_VALUES,
  SERIES_VALUES,
} from "@/server/db/schema/enums";

const LOCALE_VALUES = ["fr", "en"] as const;
const THEME_VALUES = ["light", "dark", "system"] as const;

/**
 * Schema used by Clerk webhook & onboarding completion.
 * `clerkId` and `email` are required; everything else is optional.
 */
export const createUserSchema = z.object({
  clerkId: z.string().min(1, "clerkId is required").max(255),
  email: z.email("Invalid email"),
  phone: z.string().max(40).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatarUrl: z.url().optional(),
  role: z.enum(USER_ROLE_VALUES).default("student"),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  language: z.enum(LOCALE_VALUES).default("fr"),
  theme: z.enum(THEME_VALUES).default("system"),
  onboardingCompleted: z.boolean().default(false),
  weeklyGoal: z.number().int().min(0).max(100).default(5),
});

/**
 * Schema for partial updates — all fields optional except id.
 */
export const updateUserSchema = z.object({
  id: z.uuid(),
  phone: z.string().max(40).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatarUrl: z.url().optional(),
  role: z.enum(USER_ROLE_VALUES).optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  language: z.enum(LOCALE_VALUES).optional(),
  theme: z.enum(THEME_VALUES).optional(),
  onboardingCompleted: z.boolean().optional(),
  weeklyGoal: z.number().int().min(0).max(100).optional(),
});

/**
 * Schema for the onboarding form (role + level + series + weekly goal).
 */
export const onboardingUserSchema = z.object({
  role: z.enum(USER_ROLE_VALUES),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  weeklyGoal: z.number().int().min(1).max(50).default(5),
  language: z.enum(LOCALE_VALUES).default("fr"),
  theme: z.enum(THEME_VALUES).default("system"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type OnboardingUserInput = z.infer<typeof onboardingUserSchema>;
