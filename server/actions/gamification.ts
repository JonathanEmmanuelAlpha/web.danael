"use server";

/**
 * §5.8 — Gamification server actions.
 *
 * Wraps the gamification service with auth + RBAC + Zod validation. Each
 * action returns a typed ApiResponse<T>.
 *
 * Authorization rules:
 *  - All read actions (getPoints, getStreak, getGoals, getBadges,
 *    getUserBadges, getActivities, getLeaderboard) → any authenticated user
 *    (most often the calling user views their own profile)
 *  - freezeStreak → any authenticated user (only acts on self)
 *  - createGoal → any authenticated user (goal is created for the caller)
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  createWeeklyGoalSchema,
  leaderboardQuerySchema,
  updateGoalProgressSchema,
  type CreateWeeklyGoalInput,
  type LeaderboardQuery,
  type ListUserGoalsQuery,
  type UpdateGoalProgressInput,
} from "@/server/validators/gamification";
import * as gamificationService from "@/server/services/gamification";
import type {
  ActivityWithMeta,
  BadgeWithEarned,
  GoalWithProgress,
  LeaderboardResult,
  StreakInfo,
  UserPointsWithLevel,
} from "@/server/services/gamification";

/* ── Helpers ───────────────────────────────────────────────── */

async function requireUser() {
  const session = await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");
  return { session, user: dbUser };
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getPointsAction(): Promise<
  ApiResponse<UserPointsWithLevel>
> {
  try {
    const { user } = await requireUser();
    const data = await gamificationService.getUserPoints(user.id);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getPointsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch points" },
    };
  }
}

export async function getStreakAction(): Promise<ApiResponse<StreakInfo>> {
  try {
    const { user } = await requireUser();
    const data = await gamificationService.getUserStreak(user.id);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getStreakAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch streak" },
    };
  }
}

export async function getGoalsAction(
  filters?: ListUserGoalsQuery,
): Promise<ApiResponse<GoalWithProgress[]>> {
  try {
    const { user } = await requireUser();
    const data = await gamificationService.getWeeklyGoals(user.id, filters);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getGoalsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch goals" },
    };
  }
}

export async function getBadgesAction(): Promise<ApiResponse<BadgeWithEarned[]>> {
  try {
    const { user } = await requireUser();
    const data = await gamificationService.listBadges(user.id);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getBadgesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch badges" },
    };
  }
}

export async function getUserBadgesAction(): Promise<
  ApiResponse<
    Array<{
      id: string;
      badge: gamificationService.Badge;
      earnedAt: Date;
    }>
  >
> {
  try {
    const { user } = await requireUser();
    const data = await gamificationService.getUserBadges(user.id);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getUserBadgesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch earned badges" },
    };
  }
}

export async function getActivitiesAction(
  limit = 20,
): Promise<ApiResponse<ActivityWithMeta[]>> {
  try {
    const { user } = await requireUser();
    const data = await gamificationService.listUserActivities(user.id, limit);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getActivitiesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch activities" },
    };
  }
}

export async function getLeaderboardAction(
  query: LeaderboardQuery,
): Promise<ApiResponse<LeaderboardResult>> {
  try {
    await requireSession();
    const parsed = leaderboardQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw AppError.validation("Invalid query", parsed.error.flatten());
    }
    const data = await gamificationService.getLeaderboard(parsed.data);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getLeaderboardAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch leaderboard" },
    };
  }
}

/* ── Mutations ─────────────────────────────────────────────── */

export async function createGoalAction(
  input: CreateWeeklyGoalInput,
): Promise<ApiResponse<GoalWithProgress>> {
  try {
    const { user } = await requireUser();
    const parsed = createWeeklyGoalSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const goal = await gamificationService.createWeeklyGoal(user.id, parsed.data);
    revalidatePath("/progress");
    return { success: true, data: { ...goal, progressPercent: 0, isCompleted: false } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("createGoalAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create goal" },
    };
  }
}

export async function updateGoalProgressAction(
  input: UpdateGoalProgressInput,
): Promise<ApiResponse<GoalWithProgress>> {
  try {
    const { user } = await requireUser();
    const parsed = updateGoalProgressSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Verify the goal belongs to the caller (defensive — the service uses goalId only).
    const goals = await gamificationService.getWeeklyGoals(user.id);
    const owned = goals.find((g) => g.id === parsed.data.goalId);
    if (!owned) {
      throw AppError.forbidden("You can only update your own goals");
    }

    const updated = await gamificationService.updateGoalProgress(
      parsed.data.goalId,
      parsed.data.increment,
    );
    revalidatePath("/progress");
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("updateGoalProgressAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update goal" },
    };
  }
}

export async function freezeStreakAction(): Promise<ApiResponse<StreakInfo>> {
  try {
    const { user } = await requireUser();
    const data = await gamificationService.freezeStreak(user.id);
    revalidatePath("/progress");
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("freezeStreakAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not freeze streak" },
    };
  }
}
