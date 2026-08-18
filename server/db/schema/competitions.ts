/**
 * §10.3 — Competitions & gamification badges.
 *
 * - competitions (class / school / regional / national contests)
 * - competition_participants (ranking per user)
 * - badges (catalog of earnable badges)
 * - user_badges (badges earned by users — kept here next to badges)
 */
import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean as pgBoolean,
  integer as pgInteger,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { pgRef } from "./_env";
import { users } from "./users";
import { schools, subjects, subjectSkills } from "./schools";
import {
  competitionScopeEnum,
  competitionStatusEnum,
  levelEnum,
  seriesEnum,
} from "./enums";

/* ─────────────────────────────────────────────────────────────
 * competitions
 * ──────────────────────────────────────────────────────────── */

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: pgText("title").notNull(),
    description: pgText("description"),
    scope: competitionScopeEnum("scope").notNull().default("class"),
    level: levelEnum("level"),
    series: seriesEnum("series"),
    schoolId: uuid("school_id").references(() => pgRef(schools.id), {
      onDelete: "cascade",
    }),
    /** Optional subject the competition focuses on. */
    subjectId: uuid("subject_id").references(() => pgRef(subjects.id), {
      onDelete: "set null",
    }),
    /** Optional skill the competition targets (granular targeting). */
    skillId: uuid("skill_id").references(() => pgRef(subjectSkills.id), {
      onDelete: "set null",
    }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: competitionStatusEnum("status").notNull().default("draft"),
    prizeDescription: pgText("prize_description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    scopeIdx: pgIndex("competitions_scope_idx").on(t.scope),
    levelIdx: pgIndex("competitions_level_idx").on(t.level),
    seriesIdx: pgIndex("competitions_series_idx").on(t.series),
    schoolIdx: pgIndex("competitions_school_id_idx").on(t.schoolId),
    subjectIdx: pgIndex("competitions_subject_id_idx").on(t.subjectId),
    skillIdx: pgIndex("competitions_skill_id_idx").on(t.skillId),
    statusIdx: pgIndex("competitions_status_idx").on(t.status),
    dateIdx: pgIndex("competitions_start_end_idx").on(t.startAt, t.endAt),
  }),
);

export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * competition_participants
 * ──────────────────────────────────────────────────────────── */

export const competitionParticipants = pgTable(
  "competition_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => pgRef(competitions.id), { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    score: pgInteger("score").default(0).notNull(),
    /** Final rank assigned at end of competition (1 = winner). */
    rank: pgInteger("rank"),
    /** Hide the user's name in public ranking. */
    isAnonymous: pgBoolean("is_anonymous").default(false).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    competitionUserIdx: pgUniqueIndex("competition_participants_uniq").on(
      t.competitionId,
      t.userId,
    ),
    userIdx: pgIndex("competition_participants_user_id_idx").on(t.userId),
    rankIdx: pgIndex("competition_participants_rank_idx").on(t.rank),
  }),
);

export type CompetitionParticipant =
  typeof competitionParticipants.$inferSelect;
export type NewCompetitionParticipant =
  typeof competitionParticipants.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * badges — catalog of earnable badges
 * ──────────────────────────────────────────────────────────── */

export const badges = pgTable(
  "badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: pgText("slug").notNull().unique(),
    name: pgText("name").notNull(),
    description: pgText("description"),
    iconUrl: pgText("icon_url"),
    /** e.g. "streak", "quiz", "content", "competition". */
    category: pgText("category").notNull(),
    /** Machine-readable unlock condition (e.g. JSON path or rule id). */
    condition: pgText("condition"),
    xpReward: pgInteger("xp_reward").default(0).notNull(),
    isActive: pgBoolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    slugIdx: pgUniqueIndex("badges_slug_uniq").on(t.slug),
    categoryIdx: pgIndex("badges_category_idx").on(t.category),
    activeIdx: pgIndex("badges_is_active_idx").on(t.isActive),
  }),
);

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * user_badges — earned badges per user
 * ──────────────────────────────────────────────────────────── */

export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => pgRef(badges.id), { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userBadgeIdx: pgUniqueIndex("user_badges_user_badge_uniq").on(
      t.userId,
      t.badgeId,
    ),
    badgeIdx: pgIndex("user_badges_badge_id_idx").on(t.badgeId),
  }),
);

export type UserBadge = typeof userBadges.$inferSelect;
export type NewUserBadge = typeof userBadges.$inferInsert;
