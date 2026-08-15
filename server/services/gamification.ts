/**
 * §5.8 — Gamification service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Responsibilities:
 *  - XP awarding + level computation (level = floor(totalXp / 1000) + 1)
 *  - Streak tracking (per-day activity, freeze support, max 2 freezes/week)
 *  - Weekly goals (CRUD + progress tracking)
 *  - Badge catalog + earned badges (condition evaluation)
 *  - Activity feed (append-only + opt-in XP / badge triggers)
 */

import { and, count, desc, eq, gte, lte, sql, asc, SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  badges,
  userActivities,
  userBadges,
  userGoals,
  userPoints,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type { JsonRecord } from "@/server/db/schema/_env";
import type {
  AwardXpInput,
  CreateWeeklyGoalInput,
  LeaderboardQuery,
  ListUserGoalsQuery,
  LogActivityInput,
  UpdateGoalProgressInput,
} from "@/server/validators/gamification";
import type {
  Badge,
  UserBadge,
  UserGoal,
  UserActivity,
  UserPoint,
  User,
} from "@/server/db/schema";
import { MAX_STREAK_FREEZES_PER_WEEK, XP_PER_LEVEL } from "@/lib/constants";

/* -- Constants ----------------------------------------------- */

/* -- Types --------------------------------------------------- */

export type { Badge, UserBadge, UserGoal, UserActivity, UserPoint };

export type UserPointsWithLevel = UserPoint & {
  /** Total XP needed to reach the next level. */
  xpToNextLevel: number;
  /** XP earned in the current level bracket. */
  xpInCurrentLevel: number;
  /** Progress 0-100 toward next level. */
  progressPercent: number;
};

export type StreakInfo = {
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date | null;
  /** Number of streak freezes used in the last 7 days. */
  freezesUsedThisWeek: number;
  freezesRemaining: number;
  /** True if user has been active today. */
  activeToday: boolean;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  totalXp: number;
  level: number;
  displayName: string;
  avatarUrl: string | null;
  /** True if user opted out of public ranking. */
  isHidden: boolean;
};

export type LeaderboardResult = {
  entries: LeaderboardEntry[];
  total: number;
};

export type BadgeWithEarned = Badge & {
  earned: boolean;
  earnedAt: Date | null;
};

export type ActivityWithMeta = UserActivity & {
  metadata: JsonRecord | null;
};

export type GoalWithProgress = UserGoal & {
  progressPercent: number;
  isCompleted: boolean;
};

/* -- XP / Levels --------------------------------------------- */

/**
 * Compute the level from total XP.
 * level = floor(totalXp / 1000) + 1
 */
export function computeLevel(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

/**
 * Get the user_points row for a user (creates it lazily if missing).
 */
export async function getUserPoints(
  userId: string,
): Promise<UserPointsWithLevel> {
  const db = await getDb();

  let rows = await db
    .select()
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);
  let row = rows.at(0);

  if (!row) {
    // Lazy create — the Clerk webhook usually inserts this but be defensive.
    const [created] = await db
      .insert(userPoints)
      .values({ userId, totalXp: 0, level: 1 })
      .returning();
    if (!created) throw AppError.internal("Failed to initialize user points");
    row = created;
  }

  const totalXp = row.totalXp;
  const level = computeLevel(totalXp);
  const xpInCurrentLevel = totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;
  const progressPercent = Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100);

  return {
    ...row,
    level,
    xpToNextLevel,
    xpInCurrentLevel,
    progressPercent,
  };
}

/**
 * Award XP to a user (idempotent — always adds, never subtracts).
 * Recomputes the level after the update.
 */
export async function awardXp(
  userId: string,
  amount: number,
  reason: string,
): Promise<UserPointsWithLevel> {
  if (amount <= 0) {
    throw AppError.validation("XP amount must be positive", { amount });
  }
  if (reason.length < 2 || reason.length > 200) {
    throw AppError.validation("Reason must be 2-200 chars", { reason });
  }

  const db = await getDb();

  // Ensure the user_points row exists.
  const existing = await db
    .select()
    .from(userPoints)
    .where(eq(userPoints.userId, userId))
    .limit(1);

  if (!existing.at(0)) {
    await db
      .insert(userPoints)
      .values({ userId, totalXp: 0, level: 1 })
      .onConflictDoNothing?.();
  }

  // Atomically increment + recompute level.
  await db
    .update(userPoints)
    .set({
      totalXp: sql`${userPoints.totalXp} + ${amount}`,
      level: sql`CAST((${userPoints.totalXp} + ${amount}) / ${XP_PER_LEVEL} AS INTEGER) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(userPoints.userId, userId));

  return getUserPoints(userId);
}

/* -- Leaderboard --------------------------------------------- */

/**
 * Returns the global leaderboard (top users by XP).
 *
 * Users can opt-out by setting `weeklyGoal = 0` (we treat this as a hidden flag
 * since the schema has no dedicated column). Hidden users are returned with
 * `isHidden = true` and their display name masked by the UI.
 *
 * The `scope` filter is informational at the DB level — for class/school/regional
 * scoping we'd need a join with school_members / class_members. For now we
 * support the global leaderboard (the most common use-case) and the level filter.
 */
export async function getLeaderboard(
  query: LeaderboardQuery,
): Promise<LeaderboardResult> {
  const db = await getDb();

  const conditions: SQL<unknown>[] = [];
  if (query.level) {
    conditions.push(eq(users.level, query.level as never) as never);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      userId: userPoints.userId,
      totalXp: userPoints.totalXp,
      level: userPoints.level,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      weeklyGoal: users.weeklyGoal,
    })
    .from(userPoints)
    .innerJoin(users, eq(users.id, userPoints.userId))
    .where(where)
    .orderBy(desc(userPoints.totalXp))
    .limit(query.limit);

  // Build the ranked list. Users with weeklyGoal=0 are flagged hidden.
  const entries: LeaderboardEntry[] = rows.map((r, idx) => {
    const isHidden = r.weeklyGoal === 0;
    const displayName =
      [r.firstName, r.lastName].filter(Boolean).join(" ") || "—";
    return {
      rank: idx + 1,
      userId: r.userId,
      totalXp: r.totalXp,
      level: r.level,
      displayName: isHidden ? "Anonyme" : displayName,
      avatarUrl: isHidden ? null : r.avatarUrl,
      isHidden,
    };
  });

  const totalRow = await db
    .select({ c: count() })
    .from(userPoints)
    .innerJoin(users, eq(users.id, userPoints.userId))
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  return { entries, total };
}

/* -- Streaks ------------------------------------------------- */

/**
 * Returns the user's streak info.
 */
export async function getUserStreak(userId: string): Promise<StreakInfo> {
  const db = await getDb();

  const rows = await db
    .select({
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      lastActiveAt: users.lastActiveAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows.at(0);
  if (!user) throw AppError.notFound("User not found");

  // Count freezes used in the last 7 days via user_activities.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const freezeRows = await db
    .select({ c: count() })
    .from(userActivities)
    .where(
      and(
        eq(userActivities.userId, userId),
        eq(userActivities.activityType, "earn_badge"),
        eq(userActivities.entityType, "streak_freeze"),
        gte(userActivities.createdAt, sevenDaysAgo),
      ),
    );
  const freezesUsedThisWeek = Number(freezeRows.at(0)?.c ?? 0);

  // Is the user active today?
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const activeToday = user.lastActiveAt
    ? user.lastActiveAt.getTime() >= startOfToday.getTime()
    : false;

  return {
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    lastActiveAt: user.lastActiveAt,
    freezesUsedThisWeek,
    freezesRemaining: Math.max(
      0,
      MAX_STREAK_FREEZES_PER_WEEK - freezesUsedThisWeek,
    ),
    activeToday,
  };
}

/**
 * Update the user's streak based on a new activity today.
 *
 * Rules:
 *  - If last activity was today → no change (already counted).
 *  - If last activity was yesterday → increment streak by 1.
 *  - If gap > 1 day:
 *      - If the user has freezes available AND the gap is exactly 2 days →
 *        consume one freeze and increment.
 *      - Otherwise → reset streak to 1 (today).
 *  - Update longestStreak if current exceeds it.
 *  - Update lastActiveAt to now.
 */
export async function updateStreak(userId: string): Promise<StreakInfo> {
  const db = await getDb();

  const rows = await db
    .select({
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      lastActiveAt: users.lastActiveAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows.at(0);
  if (!user) throw AppError.notFound("User not found");

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const lastActive = user.lastActiveAt;

  let newStreak = user.currentStreak;
  let freezeConsumed = false;

  if (!lastActive) {
    // First ever activity.
    newStreak = 1;
  } else {
    const startOfLastActive = new Date(
      lastActive.getFullYear(),
      lastActive.getMonth(),
      lastActive.getDate(),
    );
    const dayDiff = Math.round(
      (startOfToday.getTime() - startOfLastActive.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (dayDiff <= 0) {
      // Already active today — no change.
      newStreak = user.currentStreak;
    } else if (dayDiff === 1) {
      // Consecutive day — increment.
      newStreak = user.currentStreak + 1;
    } else if (dayDiff === 2) {
      // Gap of 2 days — try to use a freeze.
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const freezeRows = await db
        .select({ c: count() })
        .from(userActivities)
        .where(
          and(
            eq(userActivities.userId, userId),
            eq(userActivities.activityType, "earn_badge"),
            eq(userActivities.entityType, "streak_freeze"),
            gte(userActivities.createdAt, sevenDaysAgo),
          ),
        );
      const freezesUsedThisWeek = Number(freezeRows.at(0)?.c ?? 0);
      if (freezesUsedThisWeek < MAX_STREAK_FREEZES_PER_WEEK) {
        // Consume a freeze — the missed day is "covered" so we still increment.
        newStreak = user.currentStreak + 1;
        freezeConsumed = true;
      } else {
        // No freezes left → reset.
        newStreak = 1;
      }
    } else {
      // Gap too large — reset regardless of freezes.
      newStreak = 1;
    }
  }

  const longestStreak = Math.max(user.longestStreak, newStreak);

  await db
    .update(users)
    .set({
      currentStreak: newStreak,
      longestStreak,
      lastActiveAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  if (freezeConsumed) {
    // Record the freeze consumption as an activity entry.
    await db.insert(userActivities).values({
      userId,
      activityType: "earn_badge",
      entityType: "streak_freeze",
      entityId: `freeze-${now.toISOString()}`,
      metadata: {
        reason: "streak_gap_protected",
        previousStreak: user.currentStreak,
      },
    });
  }

  // Re-fetch the streak info (with refreshed freeze count).
  return getUserStreak(userId);
}

/**
 * Manually consume a streak freeze (e.g. when user knows they'll miss a day).
 * Used by the "Freeze streak" button. Respects the 2/week limit.
 */
export async function freezeStreak(userId: string): Promise<StreakInfo> {
  const db = await getDb();

  // Count freezes used in the last 7 days.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const freezeRows = await db
    .select({ c: count() })
    .from(userActivities)
    .where(
      and(
        eq(userActivities.userId, userId),
        eq(userActivities.activityType, "earn_badge"),
        eq(userActivities.entityType, "streak_freeze"),
        gte(userActivities.createdAt, sevenDaysAgo),
      ),
    );
  const freezesUsedThisWeek = Number(freezeRows.at(0)?.c ?? 0);

  if (freezesUsedThisWeek >= MAX_STREAK_FREEZES_PER_WEEK) {
    throw AppError.conflict(
      `You have already used ${MAX_STREAK_FREEZES_PER_WEEK} streak freezes this week`,
    );
  }

  // Record the freeze.
  await db.insert(userActivities).values({
    userId,
    activityType: "earn_badge",
    entityType: "streak_freeze",
    entityId: `freeze-${new Date().toISOString()}`,
    metadata: { reason: "manual_freeze" },
  });

  return getUserStreak(userId);
}

/* -- Weekly goals -------------------------------------------- */

/**
 * List the user's goals with computed progress.
 */
export async function getWeeklyGoals(
  userId: string,
  filters?: ListUserGoalsQuery,
): Promise<GoalWithProgress[]> {
  const db = await getDb();

  const conditions = [eq(userGoals.userId, userId)];
  if (filters?.status) conditions.push(eq(userGoals.status, filters.status));
  if (filters?.period) conditions.push(eq(userGoals.period, filters.period));

  const rows = await db
    .select()
    .from(userGoals)
    .where(and(...conditions))
    .orderBy(desc(userGoals.createdAt));

  return rows.map((g) => {
    const progressPercent = Math.min(
      100,
      Math.round((g.currentValue / g.targetValue) * 100),
    );
    return {
      ...g,
      progressPercent,
      isCompleted: g.status === "completed" || g.currentValue >= g.targetValue,
    };
  });
}

/**
 * Create a new weekly / monthly goal.
 */
export async function createWeeklyGoal(
  userId: string,
  input: CreateWeeklyGoalInput,
): Promise<UserGoal> {
  const db = await getDb();
  const [created] = await db
    .insert(userGoals)
    .values({
      userId,
      type: input.type,
      targetValue: input.targetValue,
      currentValue: 0,
      period: input.period,
      status: "active",
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create goal");
  return created;
}

/**
 * Increment a goal's progress. Auto-marks as completed when target reached.
 * Awards bonus XP (50) when the goal is first completed.
 */
export async function updateGoalProgress(
  goalId: string,
  increment: number,
): Promise<GoalWithProgress> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(userGoals)
    .where(eq(userGoals.id, goalId))
    .limit(1);
  const goal = rows.at(0);
  if (!goal) throw AppError.notFound("Goal not found");

  const newValue = goal.currentValue + increment;
  const wasCompleted = goal.currentValue >= goal.targetValue;
  const isCompleted = newValue >= goal.targetValue;

  const [updated] = await db
    .update(userGoals)
    .set({
      currentValue: newValue,
      status: isCompleted ? "completed" : goal.status,
      updatedAt: new Date(),
    })
    .where(eq(userGoals.id, goalId))
    .returning();
  if (!updated) throw AppError.internal("Failed to update goal");

  // Award bonus XP the first time the goal is completed.
  if (isCompleted && !wasCompleted) {
    await awardXp(goal.userId, 50, "Goal completed");
    await logActivity(goal.userId, "earn_badge", "goal", goalId, {
      type: "goal_completed",
      goalType: goal.type,
    });
  }

  return {
    ...updated,
    progressPercent: Math.min(
      100,
      Math.round((updated.currentValue / updated.targetValue) * 100),
    ),
    isCompleted,
  };
}

/* -- Badge catalog seeding ----------------------------------- */

/**
 * The catalog of badges the platform ships with.
 *
 * Conditions are evaluated by `checkBadgeCondition`. New badges can be added
 * to the DB manually (e.g. by an admin) — they'll just never auto-award
 * unless their `slug` matches a known condition.
 */
const DEFAULT_BADGES: Array<{
  slug: string;
  name: string;
  description: string;
  category: string;
  condition: string;
  xpReward: number;
  iconUrl: string | null;
}> = [
  {
    slug: "first_quiz",
    name: "Premier quiz terminé",
    description: "Complétez votre tout premier quiz.",
    category: "quiz",
    condition: "first_quiz",
    xpReward: 50,
    iconUrl: null,
  },
  {
    slug: "first_content",
    name: "Première fiche lue",
    description: "Consultez votre première ressource.",
    category: "content",
    condition: "first_content",
    xpReward: 25,
    iconUrl: null,
  },
  {
    slug: "first_submission",
    name: "Première soumission",
    description: "Rendez votre premier devoir.",
    category: "assignment",
    condition: "first_submission",
    xpReward: 75,
    iconUrl: null,
  },
  {
    slug: "streak_7",
    name: "Régularité 7 jours",
    description: "Maintenez une série d'activité de 7 jours.",
    category: "streak",
    condition: "streak_7",
    xpReward: 100,
    iconUrl: null,
  },
  {
    slug: "streak_30",
    name: "Persévérance 30 jours",
    description: "Atteignez une série (record) de 30 jours.",
    category: "streak",
    condition: "streak_30",
    xpReward: 300,
    iconUrl: null,
  },
  {
    slug: "quiz_master",
    name: "Maître des quiz",
    description: "Complétez 10 quiz.",
    category: "quiz",
    condition: "quiz_master",
    xpReward: 200,
    iconUrl: null,
  },
  {
    slug: "excellent_week",
    name: "Excellence hebdomadaire",
    description: "Atteignez tous vos objectifs hebdomadaires en cours.",
    category: "goal",
    condition: "excellent_week",
    xpReward: 150,
    iconUrl: null,
  },
];

/**
 * Lazily seed the badge catalog the first time it's accessed.
 *
 * Idempotent — uses ON CONFLICT DO NOTHING for SQLite (or `onConflictDoNothing`
 * for Postgres) so concurrent calls / repeated calls are safe.
 */
export async function ensureBadgesSeeded(): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ id: badges.id }).from(badges).limit(1);
  if (rows.length > 0) return;

  for (const b of DEFAULT_BADGES) {
    await db
      .insert(badges)
      .values({
        slug: b.slug,
        name: b.name,
        description: b.description,
        category: b.category,
        condition: b.condition,
        xpReward: b.xpReward,
        iconUrl: b.iconUrl,
        isActive: true,
      })
      .onConflictDoNothing?.({ target: badges.slug });
  }
}

/* -- Badges -------------------------------------------------- */

/**
 * List the badge catalog, optionally annotated with whether the given user
 * has earned each one.
 */
export async function listBadges(userId?: string): Promise<BadgeWithEarned[]> {
  const db = await getDb();

  // Lazy-seed the catalog on first access (idempotent).
  await ensureBadgesSeeded();

  const badgesRows = await db
    .select()
    .from(badges)
    .where(eq(badges.isActive, true))
    .orderBy(asc(badges.category), asc(badges.name));

  if (!userId) {
    return badgesRows.map((b) => ({
      ...b,
      earned: false,
      earnedAt: null,
    }));
  }

  // Fetch the user's earned badge IDs in one shot.
  const earnedRows = await db
    .select({
      badgeId: userBadges.badgeId,
      earnedAt: userBadges.earnedAt,
    })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));

  const earnedMap = new Map(earnedRows.map((r) => [r.badgeId, r.earnedAt]));

  return badgesRows.map((b) => ({
    ...b,
    earned: earnedMap.has(b.id),
    earnedAt: earnedMap.get(b.id) ?? null,
  }));
}

/**
 * List the badges earned by a user.
 */
export async function getUserBadges(userId: string): Promise<
  Array<{
    id: string;
    badge: Badge;
    earnedAt: Date;
  }>
> {
  const db = await getDb();
  const rows = await db
    .select({
      id: userBadges.id,
      earnedAt: userBadges.earnedAt,
      badge: badges,
    })
    .from(userBadges)
    .innerJoin(badges, eq(badges.id, userBadges.badgeId))
    .where(eq(userBadges.userId, userId))
    .orderBy(desc(userBadges.earnedAt));

  return rows;
}

/**
 * Award a badge to a user (idempotent). If the badge condition is not yet
 * satisfied, returns null (no error). If already earned, returns the existing
 * row. On first earn, adds the badge XP reward and logs an activity.
 *
 * The `condition` field on the badge is a slug like "first_quiz",
 * "streak_7", "quiz_master", etc. — we evaluate these conditions inside
 * `checkBadgeCondition`.
 */
export async function awardBadge(
  userId: string,
  badgeSlug: string,
): Promise<{ badge: Badge; earnedAt: Date; isNew: boolean } | null> {
  const db = await getDb();

  // Find the badge by slug.
  const badgeRows = await db
    .select()
    .from(badges)
    .where(eq(badges.slug, badgeSlug))
    .limit(1);
  const badge = badgeRows.at(0);
  if (!badge || !badge.isActive) return null;

  // Check if already earned.
  const existing = await db
    .select()
    .from(userBadges)
    .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id)))
    .limit(1);
  if (existing.at(0)) {
    return { badge, earnedAt: existing.at(0)!.earnedAt, isNew: false };
  }

  // Evaluate the badge condition.
  const satisfied = await checkBadgeCondition(userId, badgeSlug);
  if (!satisfied) return null;

  // Award the badge.
  const [created] = await db
    .insert(userBadges)
    .values({ userId, badgeId: badge.id })
    .returning();
  if (!created) throw AppError.internal("Failed to award badge");

  // Add XP reward.
  if (badge.xpReward > 0) {
    await awardXp(userId, badge.xpReward, `Badge: ${badge.name}`);
  }

  // Log activity.
  await logActivity(userId, "earn_badge", "badge", badge.id, {
    slug: badge.slug,
    xpReward: badge.xpReward,
  });

  return { badge, earnedAt: created.earnedAt, isNew: true };
}

/**
 * Evaluate the badge condition for the given user.
 *
 * Supported conditions:
 *  - first_quiz: user has completed at least 1 quiz session
 *  - first_content: user has viewed at least 1 content
 *  - first_submission: user has submitted at least 1 assignment
 *  - streak_7: user's current streak >= 7
 *  - streak_30: user's longest streak >= 30
 *  - quiz_master: user has completed >= 10 quizzes
 *  - excellent_week: user has all active weekly goals completed this week
 *
 * For unknown conditions, returns false (defensive — never auto-awards).
 */
export async function checkBadgeCondition(
  userId: string,
  badgeSlug: string,
): Promise<boolean> {
  const db = await getDb();

  switch (badgeSlug) {
    case "first_quiz":
    case "first_quiz_completed": {
      const rows = await db
        .select({ c: count() })
        .from(userActivities)
        .where(
          and(
            eq(userActivities.userId, userId),
            eq(userActivities.activityType, "complete_quiz"),
          ),
        );
      return Number(rows.at(0)?.c ?? 0) >= 1;
    }

    case "first_content":
    case "first_content_viewed": {
      const rows = await db
        .select({ c: count() })
        .from(userActivities)
        .where(
          and(
            eq(userActivities.userId, userId),
            eq(userActivities.activityType, "view_content"),
          ),
        );
      return Number(rows.at(0)?.c ?? 0) >= 1;
    }

    case "first_submission":
    case "first_assignment_submitted": {
      const rows = await db
        .select({ c: count() })
        .from(userActivities)
        .where(
          and(
            eq(userActivities.userId, userId),
            eq(userActivities.activityType, "submit_assignment"),
          ),
        );
      return Number(rows.at(0)?.c ?? 0) >= 1;
    }

    case "streak_7":
    case "streak_7_days": {
      const rows = await db
        .select({ streak: users.currentStreak })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return (rows.at(0)?.streak ?? 0) >= 7;
    }

    case "streak_30":
    case "streak_30_days": {
      const rows = await db
        .select({ streak: users.longestStreak })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return (rows.at(0)?.streak ?? 0) >= 30;
    }

    case "quiz_master": {
      const rows = await db
        .select({ c: count() })
        .from(userActivities)
        .where(
          and(
            eq(userActivities.userId, userId),
            eq(userActivities.activityType, "complete_quiz"),
          ),
        );
      return Number(rows.at(0)?.c ?? 0) >= 10;
    }

    case "excellent_week":
    case "excellent_weekly": {
      const goals = await getWeeklyGoals(userId, { status: "active" });
      if (goals.length === 0) return false;
      return goals.every((g) => g.isCompleted);
    }

    default:
      // Unknown conditions are never auto-awarded.
      return false;
  }
}

/* -- Activity feed ------------------------------------------- */

/**
 * List the most recent activities for a user (newest first).
 */
export async function listUserActivities(
  userId: string,
  limit = 20,
): Promise<ActivityWithMeta[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userActivities)
    .where(eq(userActivities.userId, userId))
    .orderBy(desc(userActivities.createdAt))
    .limit(Math.min(limit, 100));
  return rows;
}

/**
 * Append a new activity to the feed. Optionally awards XP based on the
 * activity type, then re-evaluates relevant badge conditions.
 *
 * This is the canonical entry point after any meaningful user action.
 */
export async function logActivity(
  userId: string,
  type: LogActivityInput["type"],
  entityType: string,
  entityId: string,
  metadata?: JsonRecord,
): Promise<UserActivity> {
  const db = await getDb();

  const [created] = await db
    .insert(userActivities)
    .values({
      userId,
      activityType: type,
      entityType,
      entityId,
      metadata: metadata ?? null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to log activity");

  // Award XP based on activity type.
  const xpMap: Partial<Record<LogActivityInput["type"], number>> = {
    view_content: 5,
    download_content: 10,
    submit_assignment: 50,
    complete_quiz: 75,
    earn_badge: 0, // XP already awarded by awardBadge()
    join_class: 25,
    post_message: 5,
    rate_content: 15,
  };

  const xpAmount = xpMap[type] ?? 0;
  if (xpAmount > 0) {
    // Don't re-trigger awardBadge here for earn_badge type (already done).
    await awardXp(userId, xpAmount, `Activity: ${type}`).catch(() => {
      // Best-effort — don't fail the activity log if XP fails.
    });
  }

  // Update the streak (this is the canonical call point for streak tracking).
  if (type !== "earn_badge") {
    await updateStreak(userId).catch(() => {
      // Best-effort — don't fail the activity log if streak update fails.
    });
  }

  // Re-evaluate relevant badge conditions (best-effort, fire-and-forget).
  const badgeTriggers: Partial<Record<LogActivityInput["type"], string[]>> = {
    complete_quiz: ["first_quiz", "quiz_master"],
    view_content: ["first_content"],
    submit_assignment: ["first_submission"],
  };
  const triggers = badgeTriggers[type] ?? [];
  for (const slug of triggers) {
    await awardBadge(userId, slug).catch(() => {
      // Best-effort.
    });
  }

  // Streak badges — evaluate after streak update.
  if (type !== "earn_badge") {
    const streak = await getUserStreak(userId).catch(() => null);
    if (streak) {
      if (streak.currentStreak >= 7) {
        await awardBadge(userId, "streak_7").catch(() => undefined);
      }
      if (streak.longestStreak >= 30) {
        await awardBadge(userId, "streak_30").catch(() => undefined);
      }
    }
  }

  return created;
}
