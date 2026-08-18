/**
 * Adaptive Learning Loop — Schema complet (Phases 1, 2, 3)
 *
 * Tables:
 *  - skill_nodes          : knowledge graph (domain > topic > skill > subskill)
 *  - student_skill_states : per-student mastery level per skill (with forgetting curve)
 *  - question_skill_links : links quiz questions to skill nodes
 *  - learning_plans       : weekly plans generated from diagnostics
 *  - plan_tasks           : daily micro-tasks within a plan
 *  - diagnostic_sessions  : diagnostic assessment sessions
 *  - diagnostic_answers   : per-question answers within a diagnostic
 *  - learning_events      : activity tracking events (batch-saved from Zustand)
 *  - mastery_history      : historical mastery snapshots (for projections)
 *  - warmup_sessions      : daily 3-question warm-up sessions
 *  - emotional_checkins   : weekly emoji check-ins
 *  - peer_signals         : aggregated peer insights (computed)
 */

import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean,
  integer as pgInteger,
  real as pgReal,
  jsonb,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { pgRef } from "./_env";
import { users } from "./users";
import { subjects } from "./schools";
import { quizQuestions } from "./quizzes";
import {
  skillNodeTypeEnum,
  learningEventTypeEnum,
  planTaskStatusEnum,
  planTaskTypeEnum,
  diagnosticStatusEnum,
  emotionalStateEnum,
  warmupStatusEnum,
  difficultyEnum,
  levelEnum,
} from "./enums";
import type { JsonRecord } from "./_env";

/* ─────────────────────────────────────────────────────────────
 * skill_nodes — Knowledge graph hierarchy
 * ──────────────────────────────────────────────────────────── */

export const skillNodes = pgTable(
  "skill_nodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Parent node (null for top-level domains like "Mathématiques"). */
    parentId: uuid("parent_id"),
    subjectId: uuid("subject_id").references(() => pgRef(subjects.id), {
      onDelete: "set null",
    }),
    code: pgText("code").notNull(),
    name: pgText("name").notNull(),
    description: pgText("description"),
    type: skillNodeTypeEnum("type").notNull().default("skill"),
    level: levelEnum("level"),
    /** Estimated difficulty 1-5 for new students. */
    defaultDifficulty: pgInteger("default_difficulty").default(3).notNull(),
    /** Order within parent. */
    position: pgInteger("position").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    parentIdx: pgIndex("skill_nodes_parent_id_idx").on(t.parentId),
    subjectIdx: pgIndex("skill_nodes_subject_id_idx").on(t.subjectId),
    codeIdx: pgUniqueIndex("skill_nodes_code_uniq").on(t.code),
    typeIdx: pgIndex("skill_nodes_type_idx").on(t.type),
  }),
);

export type SkillNode = typeof skillNodes.$inferSelect;
export type NewSkillNode = typeof skillNodes.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * skill_prerequisites — DAG edges (A requires B)
 * ──────────────────────────────────────────────────────────── */

export const skillPrerequisites = pgTable(
  "skill_prerequisites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => pgRef(skillNodes.id), { onDelete: "cascade" }),
    prerequisiteId: uuid("prerequisite_id")
      .notNull()
      .references(() => pgRef(skillNodes.id), { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    skillPrereqIdx: pgUniqueIndex("skill_prerequisites_uniq").on(
      t.skillId,
      t.prerequisiteId,
    ),
  }),
);

export type SkillPrerequisite = typeof skillPrerequisites.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * student_skill_states — Per-student mastery with forgetting curve
 * ──────────────────────────────────────────────────────────── */

export const studentSkillStates = pgTable(
  "student_skill_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => pgRef(skillNodes.id), { onDelete: "cascade" }),
    /** Mastery level 0-100. */
    mastery: pgInteger("mastery").default(0).notNull(),
    /** Confidence (std dev of recent attempts) — lower = more confident. */
    confidence: pgReal("confidence").default(50).notNull(),
    /** Number of times this skill has been practiced. */
    practiceCount: pgInteger("practice_count").default(0).notNull(),
    /** Number of correct answers. */
    correctCount: pgInteger("correct_count").default(0).notNull(),
    /** Last time this skill was practiced. */
    lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
    /** Predicted mastery right now (accounting for forgetting curve). */
    predictedMastery: pgReal("predicted_mastery").default(0).notNull(),
    /** Personalized forgetting rate (higher = forgets faster). */
    forgettingRate: pgReal("forgetting_rate").default(0.5).notNull(),
    /** Trend: +1 improving, 0 stable, -1 declining. */
    trend: pgInteger("trend").default(0).notNull(),
    /** Weekly velocity (mastery delta per week) — used by Talent Score. */
    velocity: pgReal("velocity").default(0).notNull(),
    /** Transfer score 0-1 (success on transfer-tagged questions). */
    transferScore: pgReal("transfer_score").default(0).notNull(),
    /** Joy signal 0-1 (from emotional check-ins + implicit signals). */
    joyScore: pgReal("joy_score").default(0.5).notNull(),
    /** Bayesian talent confidence 0-1 (alpha / (alpha + beta)). */
    talentConfidence: pgReal("talent_confidence").default(0.286).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentSkillIdx: pgUniqueIndex("student_skill_states_uniq").on(
      t.studentId,
      t.skillId,
    ),
    studentIdx: pgIndex("student_skill_states_student_id_idx").on(t.studentId),
    skillIdx: pgIndex("student_skill_states_skill_id_idx").on(t.skillId),
    masteryIdx: pgIndex("student_skill_states_mastery_idx").on(t.mastery),
  }),
);

export type StudentSkillState = typeof studentSkillStates.$inferSelect;
export type NewStudentSkillState = typeof studentSkillStates.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * question_skill_links — Links quiz questions to skill nodes
 * ──────────────────────────────────────────────────────────── */

export const questionSkillLinks = pgTable(
  "question_skill_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => pgRef(quizQuestions.id), { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => pgRef(skillNodes.id), { onDelete: "cascade" }),
    /** How strongly this question tests this skill (0-1). */
    weight: pgReal("weight").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    questionSkillIdx: pgUniqueIndex("question_skill_links_uniq").on(
      t.questionId,
      t.skillId,
    ),
    questionIdx: pgIndex("question_skill_links_question_id_idx").on(t.questionId),
    skillIdx: pgIndex("question_skill_links_skill_id_idx").on(t.skillId),
  }),
);

export type QuestionSkillLink = typeof questionSkillLinks.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * learning_plans — Weekly plans
 * ──────────────────────────────────────────────────────────── */

export const learningPlans = pgTable(
  "learning_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** ISO week string e.g. "2026-W33". */
    weekKey: pgText("week_key").notNull(),
    /** Diagnostic session that generated this plan. */
    diagnosticSessionId: uuid("diagnostic_session_id"),
    /** Overall target mastery increase for the week (e.g. +8 points). */
    targetProgress: pgInteger("target_progress").default(5).notNull(),
    /** Skills targeted this week (array of skill node IDs). */
    targetedSkills: uuid("targeted_skills").array().default([]).notNull(),
    /** Summary of strengths/weaknesses detected. */
    summary: pgText("summary"),
    /** JSON: detailed analysis { strengths: [], weaknesses: [], recommendations: [] }. */
    analysis: jsonb("analysis").$type<
      JsonRecord & {
        strengths?: string[];
        weaknesses?: string[];
        recommendations?: string[];
      }
    >(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentWeekIdx: pgUniqueIndex("learning_plans_student_week_uniq").on(
      t.studentId,
      t.weekKey,
    ),
    studentIdx: pgIndex("learning_plans_student_id_idx").on(t.studentId),
    weekIdx: pgIndex("learning_plans_week_key_idx").on(t.weekKey),
  }),
);

export type LearningPlan = typeof learningPlans.$inferSelect;
export type NewLearningPlan = typeof learningPlans.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * plan_tasks — Daily micro-tasks within a plan
 * ──────────────────────────────────────────────────────────── */

export const planTasks = pgTable(
  "plan_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => pgRef(learningPlans.id), { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Day of the week 0=Sunday ... 6=Saturday, or null for any day. */
    dayOfWeek: pgInteger("day_of_week"),
    /** Specific date for this task (for one-off tasks). */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    type: planTaskTypeEnum("type").notNull(),
    status: planTaskStatusEnum("status").notNull().default("pending"),
    title: pgText("title").notNull(),
    description: pgText("description"),
    /** Skill node targeted by this task. */
    skillId: uuid("skill_id"),
    /** Linked resource (quizId, contentId, etc.). */
    resourceId: uuid("resource_id"),
    resourceType: pgText("resource_type"),
    /** Estimated minutes. */
    estimatedMinutes: pgInteger("estimated_minutes").default(10).notNull(),
    /** Order within the day. */
    position: pgInteger("position").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    planIdx: pgIndex("plan_tasks_plan_id_idx").on(t.planId),
    studentIdx: pgIndex("plan_tasks_student_id_idx").on(t.studentId),
    statusIdx: pgIndex("plan_tasks_status_idx").on(t.status),
    scheduledIdx: pgIndex("plan_tasks_scheduled_for_idx").on(t.scheduledFor),
    skillIdx: pgIndex("plan_tasks_skill_id_idx").on(t.skillId),
  }),
);

export type PlanTask = typeof planTasks.$inferSelect;
export type NewPlanTask = typeof planTasks.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * diagnostic_sessions — Diagnostic assessment sessions
 * ──────────────────────────────────────────────────────────── */

export const diagnosticSessions = pgTable(
  "diagnostic_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Week key this diagnostic belongs to. */
    weekKey: pgText("week_key").notNull(),
    status: diagnosticStatusEnum("status").notNull().default("in_progress"),
    /** Number of questions in the diagnostic. */
    totalQuestions: pgInteger("total_questions").default(0).notNull(),
    /** Number of correct answers. */
    correctAnswers: pgInteger("correct_answers").default(0).notNull(),
    /** Percentage score 0-100. */
    score: pgReal("score").default(0).notNull(),
    /** Seconds spent. */
    timeSpent: pgInteger("time_spent").default(0).notNull(),
    /** JSON: skills assessed with before/after mastery. */
    skillSnapshot: jsonb("skill_snapshot").$type<JsonRecord>(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("diagnostic_sessions_student_id_idx").on(t.studentId),
    weekIdx: pgIndex("diagnostic_sessions_week_key_idx").on(t.weekKey),
    statusIdx: pgIndex("diagnostic_sessions_status_idx").on(t.status),
  }),
);

export type DiagnosticSession = typeof diagnosticSessions.$inferSelect;
export type NewDiagnosticSession = typeof diagnosticSessions.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * diagnostic_answers — Per-question answers within a diagnostic
 * ──────────────────────────────────────────────────────────── */

export const diagnosticAnswers = pgTable(
  "diagnostic_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => pgRef(diagnosticSessions.id), { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => pgRef(quizQuestions.id), { onDelete: "cascade" }),
    skillId: uuid("skill_id").references(() => pgRef(skillNodes.id), {
      onDelete: "set null",
    }),
    /** Selected option ID or free-text answer. */
    selectedOptionId: uuid("selected_option_id"),
    answerText: pgText("answer_text"),
    isCorrect: boolean("is_correct"),
    /** Difficulty the student faced (IRT-adjusted). */
    perceivedDifficulty: pgInteger("perceived_difficulty").default(3).notNull(),
    timeSpent: pgInteger("time_spent").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    sessionIdx: pgIndex("diagnostic_answers_session_id_idx").on(t.sessionId),
    questionIdx: pgIndex("diagnostic_answers_question_id_idx").on(t.questionId),
    skillIdx: pgIndex("diagnostic_answers_skill_id_idx").on(t.skillId),
  }),
);

export type DiagnosticAnswer = typeof diagnosticAnswers.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * learning_events — Activity tracking (batch-saved from Zustand)
 * ──────────────────────────────────────────────────────────── */

export const learningEvents = pgTable(
  "learning_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    type: learningEventTypeEnum("type").notNull(),
    /** Related resource ID (quizId, contentId, questionId, etc.). */
    resourceId: uuid("resource_id"),
    resourceType: pgText("resource_type"),
    /** Skill node involved (if any). */
    skillId: uuid("skill_id"),
    /** Whether the activity was successful (correct answer, completed quiz). */
    success: boolean("success"),
    /** Score / percentage if applicable. */
    score: pgReal("score"),
    /** Seconds spent on the activity. */
    durationSec: pgInteger("duration_sec").default(0).notNull(),
    /** JSON metadata. */
    metadata: jsonb("metadata").$type<JsonRecord>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("learning_events_student_id_idx").on(t.studentId),
    typeIdx: pgIndex("learning_events_type_idx").on(t.type),
    skillIdx: pgIndex("learning_events_skill_id_idx").on(t.skillId),
    occurredIdx: pgIndex("learning_events_occurred_at_idx").on(t.occurredAt),
  }),
);

export type LearningEvent = typeof learningEvents.$inferSelect;
export type NewLearningEvent = typeof learningEvents.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * mastery_history — Historical snapshots for projections
 * ──────────────────────────────────────────────────────────── */

export const masteryHistory = pgTable(
  "mastery_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => pgRef(skillNodes.id), { onDelete: "cascade" }),
    mastery: pgInteger("mastery").notNull(),
    /** What caused this snapshot: diagnostic, practice, warmup, etc. */
    source: pgText("source").notNull().default("practice"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("mastery_history_student_id_idx").on(t.studentId),
    skillIdx: pgIndex("mastery_history_skill_id_idx").on(t.skillId),
    recordedIdx: pgIndex("mastery_history_recorded_at_idx").on(t.recordedAt),
  }),
);

export type MasteryHistory = typeof masteryHistory.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * warmup_sessions — Daily 3-question warm-up
 * ──────────────────────────────────────────────────────────── */

export const warmupSessions = pgTable(
  "warmup_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Date string YYYY-MM-DD. */
    dateKey: pgText("date_key").notNull(),
    status: warmupStatusEnum("status").notNull().default("pending"),
    /** Question IDs used in this warm-up. */
    questionIds: uuid("question_ids").array().default([]).notNull(),
    /** Skills targeted. */
    skillIds: uuid("skill_ids").array().default([]).notNull(),
    correctCount: pgInteger("correct_count").default(0).notNull(),
    totalCount: pgInteger("total_count").default(3).notNull(),
    timeSpent: pgInteger("time_spent").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    studentDateIdx: pgUniqueIndex("warmup_sessions_student_date_uniq").on(
      t.studentId,
      t.dateKey,
    ),
    studentIdx: pgIndex("warmup_sessions_student_id_idx").on(t.studentId),
  }),
);

export type WarmupSession = typeof warmupSessions.$inferSelect;
export type NewWarmupSession = typeof warmupSessions.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * emotional_checkins — Weekly emoji check-ins
 * ──────────────────────────────────────────────────────────── */

export const emotionalCheckins = pgTable(
  "emotional_checkins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    weekKey: pgText("week_key").notNull(),
    state: emotionalStateEnum("state").notNull(),
    /** Optional text note. */
    note: pgText("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    studentWeekIdx: pgUniqueIndex("emotional_checkins_student_week_uniq").on(
      t.studentId,
      t.weekKey,
    ),
    studentIdx: pgIndex("emotional_checkins_student_id_idx").on(t.studentId),
  }),
);

export type EmotionalCheckin = typeof emotionalCheckins.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * peer_signals — Aggregated peer insights (computed)
 * ──────────────────────────────────────────────────────────── */

export const peerSignals = pgTable(
  "peer_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Skill node this signal applies to. */
    skillId: uuid("skill_id")
      .notNull()
      .references(() => pgRef(skillNodes.id), { onDelete: "cascade" }),
    /** Resource that helped peers (contentId, quizId, etc.). */
    resourceId: uuid("resource_id").notNull(),
    resourceType: pgText("resource_type").notNull(),
    /** Number of peers who found this useful for this skill. */
    helpfulCount: pgInteger("helpful_count").default(0).notNull(),
    /** Average mastery improvement after using this resource. */
    avgImprovement: pgReal("avg_improvement").default(0).notNull(),
    /** Computed at (for cache invalidation). */
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    skillIdx: pgIndex("peer_signals_skill_id_idx").on(t.skillId),
    resourceIdx: pgIndex("peer_signals_resource_id_idx").on(t.resourceId),
  }),
);

export type PeerSignal = typeof peerSignals.$inferSelect;
