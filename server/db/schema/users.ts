/**
 * §10.3 — Users & gamification tables.
 *
 * - users (identity mirror of Clerk, role/level/streaks)
 * - user_points (XP aggregates)
 * - user_goals (weekly/monthly objectives)
 * - user_activities (audit-style activity feed)
 */
import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean,
  integer as pgInteger,
  jsonb,
  index,
  date,
} from "drizzle-orm/pg-core";

import { type JsonRecord, pgRef } from "./_env";
import {
  userRoleEnum,
  levelEnum,
  seriesEnum,
  goalTypeEnum,
  goalPeriodEnum,
  goalStatusEnum,
  activityTypeEnum,
  onboardingStatusEnum,
  userGenderEnum,
} from "./enums";
import { Address } from "@/types";

/* -------------------------------------------------------------
 * users
 * ------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkId: pgText("clerk_id").notNull().unique(),
    email: pgText("email").notNull().unique(),
    phone: pgText("phone"),
    firstName: pgText("first_name"),
    lastName: pgText("last_name"),
    birthDate: timestamp("birth_date"),
    gender: userGenderEnum("gender"),
    address: jsonb("address").$type<Address>(),
    avatarUrl: pgText("avatar_url"),
    role: userRoleEnum("role").notNull().default("student"),
    level: levelEnum("level"),
    series: seriesEnum("series"),
    /** Preferred UI language (next-intl locale code). */
    language: pgText("language").default("fr").notNull(),
    /** Preferred theme: light | dark | system. */
    theme: pgText("theme").default("system").notNull(),
    onboardingStatus: onboardingStatusEnum("onboarding_status")
      .default("not_started")
      .notNull(),
    /** User-set weekly learning goal (e.g. contents to view). */
    weeklyGoal: pgInteger("weekly_goal").default(5).notNull(),
    currentStreak: pgInteger("current_streak").default(0).notNull(),
    longestStreak: pgInteger("longest_streak").default(0).notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    roleIdx: index("users_role_idx").on(t.role),
    levelIdx: index("users_level_idx").on(t.level),
    clerkIdIdx: index("users_clerk_id_idx").on(t.clerkId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/* -------------------------------------------------------------
 * user_points — XP aggregates (one row per user)
 * ------------------------------------------------------------ */

export const userPoints = pgTable(
  "user_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    totalXp: pgInteger("total_xp").default(0).notNull(),
    /** Gamification level derived from totalXp. */
    level: pgInteger("level").default(1).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    userIdIdx: index("user_points_user_id_idx").on(t.userId),
    levelIdx: index("user_points_level_idx").on(t.level),
  }),
);
export type UserPoint = typeof userPoints.$inferSelect;
export type NewUserPoint = typeof userPoints.$inferInsert;

/* -------------------------------------------------------------
 * user_goals — weekly / monthly objectives
 * ------------------------------------------------------------ */

export const userGoals = pgTable(
  "user_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    type: goalTypeEnum("type").notNull(),
    targetValue: pgInteger("target_value").notNull(),
    currentValue: pgInteger("current_value").default(0).notNull(),
    period: goalPeriodEnum("period").notNull(),
    status: goalStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    userIdx: index("user_goals_user_id_idx").on(t.userId),
    statusIdx: index("user_goals_status_idx").on(t.status),
  }),
);

export type UserGoal = typeof userGoals.$inferSelect;
export type NewUserGoal = typeof userGoals.$inferInsert;

/* -------------------------------------------------------------
 * user_activities — append-only activity feed
 * ------------------------------------------------------------ */

export const userActivities = pgTable(
  "user_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    activityType: activityTypeEnum("activity_type").notNull(),
    /** Polymorphic target ("content", "quiz", "assignment"…). */
    entityType: pgText("entity_type").notNull(),
    entityId: pgText("entity_id").notNull(),
    metadata: jsonb("metadata").$type<JsonRecord>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("user_activities_user_id_idx").on(t.userId),
    entityIdx: index("user_activities_entity_idx").on(t.entityType, t.entityId),
    createdIdx: index("user_activities_created_at_idx").on(t.createdAt),
  }),
);
export type UserActivity = typeof userActivities.$inferSelect;
export type NewUserActivity = typeof userActivities.$inferInsert;
