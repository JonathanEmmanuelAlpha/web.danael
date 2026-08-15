/**
 * §10.3 — Quiz engine.
 *
 * - quizzes (top-level quiz container)
 * - quiz_questions (questions ordered within a quiz)
 * - quiz_question_options (MCQ / true-false options)
 * - quiz_sessions (one attempt per user)
 * - quiz_answers (per-question answers within a session)
 * - question_banks (reusable question repository)
 */

import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean,
  integer as pgInteger,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { pgRef } from "./_env";
import { users } from "./users";
import { subjects } from "./schools";
import {
  quizTypeEnum,
  quizQuestionTypeEnum,
  quizSessionStatusEnum,
  difficultyEnum,
  levelEnum,
  seriesEnum,
  questionSourceEnum,
} from "./enums";

/* -------------------------------------------------------------
 * quizzes
 * ------------------------------------------------------------ */

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: pgText("title").notNull(),
    description: pgText("description"),
    subjectId: uuid("subject_id").references(() => pgRef(subjects.id), {
      onDelete: "set null",
    }),
    level: levelEnum("level"),
    series: seriesEnum("series"),
    type: quizTypeEnum("type").notNull().default("practice"),
    /** Total time allowed (minutes). NULL = no limit. */
    timeLimitMinutes: pgInteger("time_limit_minutes"),
    /** Minimum percentage (0-100) to pass. */
    passingScore: pgInteger("passing_score").default(50),
    isPublished: boolean("is_published").default(false).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    subjectIdx: pgIndex("quizzes_subject_id_idx").on(t.subjectId),
    levelIdx: pgIndex("quizzes_level_idx").on(t.level),
    seriesIdx: pgIndex("quizzes_series_idx").on(t.series),
    publishedIdx: pgIndex("quizzes_is_published_idx").on(t.isPublished),
    createdByIdx: pgIndex("quizzes_created_by_idx").on(t.createdBy),
  }),
);

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;

/* -------------------------------------------------------------
 * quiz_questions
 * ------------------------------------------------------------ */

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => pgRef(quizzes.id), { onDelete: "cascade" }),
    type: quizQuestionTypeEnum("type").notNull().default("single_choice"),
    label: pgText("label").notNull(),
    points: pgInteger("points").default(1).notNull(),
    explanation: pgText("explanation"),
    difficulty: difficultyEnum("difficulty").default("medium"),
    position: pgInteger("position").default(0).notNull(),
    /**
     * Source of the question:
     *  - "verified": created by a teacher via the platform (default)
     *  - "generated": created by AI, pending teacher validation
     *
     * Generated questions can be used everywhere in the app (quizzes,
     * diagnostics, warm-ups, learning plans) but display a "Generated" badge
     * until a teacher reviews and marks them as "verified".
     */
    source: questionSourceEnum("source").notNull().default("verified"),
    /** AI generation metadata (null for verified questions). */
    generatedByModel: pgText("generated_by_model"),
    generatedForSkillId: uuid("generated_for_skill_id"),
    /** Teacher who verified this question (null if still generated). */
    verifiedBy: uuid("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    quizIdx: pgIndex("quiz_questions_quiz_id_idx").on(t.quizId),
    positionIdx: pgIndex("quiz_questions_position_idx").on(t.position),
    sourceIdx: pgIndex("quiz_questions_source_idx").on(t.source),
    verifiedByIdx: pgIndex("quiz_questions_verified_by_idx").on(t.verifiedBy),
  }),
);

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;

/* -------------------------------------------------------------
 * quiz_question_options
 * ------------------------------------------------------------ */

export const quizQuestionOptions = pgTable(
  "quiz_question_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => pgRef(quizQuestions.id), { onDelete: "cascade" }),
    label: pgText("label").notNull(),
    isCorrect: boolean("is_correct").default(false).notNull(),
    position: pgInteger("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    questionIdx: pgIndex("quiz_question_options_question_id_idx").on(
      t.questionId,
    ),
  }),
);

export type QuizQuestionOption = typeof quizQuestionOptions.$inferSelect;
export type NewQuizQuestionOption = typeof quizQuestionOptions.$inferInsert;

/* -------------------------------------------------------------
 * quiz_sessions — one attempt per user
 * ------------------------------------------------------------ */

export const quizSessions = pgTable(
  "quiz_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => pgRef(quizzes.id), { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    status: quizSessionStatusEnum("status").notNull().default("in_progress"),
    totalScore: pgInteger("total_score").default(0).notNull(),
    maxScore: pgInteger("max_score").default(0).notNull(),
    /** Seconds spent on the attempt. */
    timeSpent: pgInteger("time_spent").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    quizIdx: pgIndex("quiz_sessions_quiz_id_idx").on(t.quizId),
    userIdx: pgIndex("quiz_sessions_user_id_idx").on(t.userId),
    statusIdx: pgIndex("quiz_sessions_status_idx").on(t.status),
  }),
);

export type QuizSession = typeof quizSessions.$inferSelect;
export type NewQuizSession = typeof quizSessions.$inferInsert;

/* -------------------------------------------------------------
 * quiz_answers
 * ------------------------------------------------------------ */

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => pgRef(quizSessions.id), { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => pgRef(quizQuestions.id), { onDelete: "cascade" }),
    /** Free-text answer (for short_answer / essay). */
    answerText: pgText("answer_text"),
    /** Selected option (single_choice / true_false). */
    selectedOptionId: uuid("selected_option_id"),
    isCorrect: boolean("is_correct"),
    pointsAwarded: pgInteger("points_awarded").default(0).notNull(),
    /** Seconds spent on the question. */
    timeSpent: pgInteger("time_spent").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    sessionIdx: pgIndex("quiz_answers_session_id_idx").on(t.sessionId),
    questionIdx: pgIndex("quiz_answers_question_id_idx").on(t.questionId),
    sessionQuestionIdx: pgUniqueIndex("quiz_answers_session_question_uniq").on(
      t.sessionId,
      t.questionId,
    ),
  }),
);

export type QuizAnswer = typeof quizAnswers.$inferSelect;
export type NewQuizAnswer = typeof quizAnswers.$inferInsert;

/* -------------------------------------------------------------
 * question_banks — reusable question repository
 * ------------------------------------------------------------ */

export const questionBanks = pgTable(
  "question_banks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: uuid("subject_id").references(() => pgRef(subjects.id), {
      onDelete: "set null",
    }),
    level: levelEnum("level"),
    series: seriesEnum("series"),
    label: pgText("label").notNull(),
    difficulty: difficultyEnum("difficulty").default("medium"),
    tags: pgText("tags").array().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    subjectIdx: pgIndex("question_banks_subject_id_idx").on(t.subjectId),
    levelIdx: pgIndex("question_banks_level_idx").on(t.level),
    seriesIdx: pgIndex("question_banks_series_idx").on(t.series),
    difficultyIdx: pgIndex("question_banks_difficulty_idx").on(t.difficulty),
  }),
);

export type QuestionBank = typeof questionBanks.$inferSelect;
export type NewQuestionBank = typeof questionBanks.$inferInsert;
