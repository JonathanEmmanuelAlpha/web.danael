/**
 * §10.4 — Talent Discovery & Promotion System (SDPT)
 *
 * A complete system to detect, develop and amplify each student's natural
 * talents while preserving the foundational curriculum.
 *
 * Domain:
 *  - talent_profiles           : snapshot of the student's Talent DNA Card
 *  - talent_assessment_sessions: the Talent Discovery Assessment (TDA) sessions
 *  - talent_assessment_answers : per-question answers within a TDA
 *  - student_talent_zones      : detected talent / growth zones per student
 *  - talent_tracks             : weekly personalized enrichment plans
 *  - talent_challenges         : library of advanced challenges (curated + user)
 *  - talent_track_progress     : weekly progress per talent track
 *  - mentor_recommendations    : tutor matching suggestions
 *  - talent_cohorts            : cross-school groups of same-talent students
 *  - talent_cohort_members     : membership in cohorts
 *  - career_matches            : NLP matching between North Star and careers
 *  - talent_showcase_items     : public portfolio items published by students
 *  - socratic_conversations    : AI mentor chat history
 *
 * The schema is designed to be:
 *  - Append-only for events (assessment answers, progress)
 *  - Mutable for profiles (recalculated nightly)
 *  - Privacy-first (talent data is sensitive — never exposed without consent)
 */

import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean as pgBoolean,
  integer as pgInteger,
  real as pgReal,
  jsonb,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { pgRef } from "./_env";
import { users } from "./users";
import { subjects, subjectSkills } from "./schools";
import { skillNodes } from "./learning";
import type { JsonRecord } from "./_env";

/* ─────────────────────────────────────────────────────────────
 * talent_assessment_sessions — One TDA attempt per student
 * ──────────────────────────────────────────────────────────── */

export const TDA_PHASE_VALUES = [
  "cognitive",
  "multi_subject",
  "creativity",
  "motivation",
  "completed",
] as const;
export type TdaPhaseValue = (typeof TDA_PHASE_VALUES)[number];

export const TDA_STATUS_VALUES = [
  "in_progress",
  "completed",
  "abandoned",
] as const;
export type TdaStatusValue = (typeof TDA_STATUS_VALUES)[number];

export const talentAssessmentSessions = pgTable(
  "talent_assessment_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    status: pgText("status").notNull().default("in_progress"),
    /** Current phase of the wizard. */
    currentPhase: pgText("current_phase").notNull().default("cognitive"),
    /** Total questions answered across all phases. */
    totalQuestions: pgInteger("total_questions").default(0).notNull(),
    correctAnswers: pgInteger("correct_answers").default(0).notNull(),
    /** Seconds spent on the entire assessment. */
    timeSpentSec: pgInteger("time_spent_sec").default(0).notNull(),
    /** JSON snapshot of phase-specific data (cognitive scores, creativity, etc.). */
    phaseData: jsonb("phase_data").$type<JsonRecord>(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("talent_assessment_sessions_student_id_idx").on(
      t.studentId,
    ),
    statusIdx: pgIndex("talent_assessment_sessions_status_idx").on(t.status),
  }),
);

export type TalentAssessmentSession =
  typeof talentAssessmentSessions.$inferSelect;
export type NewTalentAssessmentSession =
  typeof talentAssessmentSessions.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * talent_assessment_answers — Per-question answers within a TDA
 * ──────────────────────────────────────────────────────────── */

export const talentAssessmentAnswers = pgTable(
  "talent_assessment_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => pgRef(talentAssessmentSessions.id), {
        onDelete: "cascade",
      }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Which phase this answer belongs to. */
    phase: pgText("phase").notNull(),
    /** Domain being assessed (numerical, verbal, spatial, logic, memory,
     * subject_skill_id, creativity, motivation). */
    domain: pgText("domain").notNull(),
    /** Optional link to a subject_skill (for multi-subject phase). */
    skillId: uuid("skill_id"),
    /** Optional link to a quiz question used as item. */
    questionId: uuid("question_id"),
    /** The student's answer (text / option id / numeric). */
    answer: pgText("answer"),
    /** Whether the answer was correct (null for non-gradable phases). */
    isCorrect: pgBoolean("is_correct"),
    /** Difficulty of the item (IRT 2PL). */
    difficulty: pgReal("difficulty"),
    /** Seconds spent on this item. */
    timeSpentSec: pgInteger("time_spent_sec").default(0).notNull(),
    /** IRT-derived ability estimate after this answer. */
    abilityEstimate: pgReal("ability_estimate"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    sessionIdx: pgIndex("talent_assessment_answers_session_id_idx").on(
      t.sessionId,
    ),
    studentIdx: pgIndex("talent_assessment_answers_student_id_idx").on(
      t.studentId,
    ),
    phaseIdx: pgIndex("talent_assessment_answers_phase_idx").on(t.phase),
    domainIdx: pgIndex("talent_assessment_answers_domain_idx").on(t.domain),
  }),
);

export type TalentAssessmentAnswer =
  typeof talentAssessmentAnswers.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * talent_profiles — The Talent DNA Card snapshot
 *
 * One row per student, versioned. Updated nightly by the talent
 * scoring job. The JSONB `cognitiveScores` and `domainScores`
 * fields store the radar chart data.
 * ──────────────────────────────────────────────────────────── */

export const talentProfiles = pgTable(
  "talent_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Bumped every time the profile is recalculated. */
    version: pgInteger("version").default(1).notNull(),
    /** Cognitive ability scores 0-100 (numerical, verbal, spatial, logic, memory). */
    cognitiveScores: jsonb("cognitive_scores").$type<
      JsonRecord & {
        numerical?: number;
        verbal?: number;
        spatial?: number;
        logic?: number;
        memory?: number;
      }
    >(),
    /** Domain scores 0-100 per subject (radar chart axes). */
    domainScores: jsonb("domain_scores").$type<
      JsonRecord & Record<string, number>
    >(),
    /** Creativity score 0-100 (fluency, originality, flexibility, elaboration). */
    creativityScore: pgReal("creativity_score").default(0).notNull(),
    /** Engagement score 0-100 (computed from learning_events). */
    engagementScore: pgReal("engagement_score").default(0).notNull(),
    /** Detected talent zones (top skills). */
    detectedZones: pgText("detected_zones").array().default([]).notNull(),
    /** Growth zones (weakest skills to develop). */
    growthZones: pgText("growth_zones").array().default([]).notNull(),
    /** The skill the student chose to maximize. */
    northStarSkillId: uuid("north_star_skill_id").references(() =>
      pgRef(subjectSkills.id),
    ),
    /** Tier achieved on the North Star. */
    northStarTier: pgText("north_star_tier").default("seedling").notNull(),
    /** Overall talent score 0-1 (composite). */
    overallTalentScore: pgReal("overall_talent_score").default(0).notNull(),
    /** Link to the latest TDA session that produced this profile. */
    assessmentSessionId: uuid("assessment_session_id"),
    /** Whether the student opted-in to public showcase. */
    isPublicShowcase: pgBoolean("is_public_showcase")
      .default(false)
      .notNull(),
    /** Whether the student consented to mentor matching. */
    mentorMatchConsent: pgBoolean("mentor_match_consent")
      .default(false)
      .notNull(),
    /** Whether the student consented to cross-school cohort matching. */
    cohortMatchConsent: pgBoolean("cohort_match_consent")
      .default(false)
      .notNull(),
    /** Whether the student consented to AI Socratic mentor. */
    aiMentorConsent: pgBoolean("ai_mentor_consent").default(true).notNull(),
    /** Last time the floor monitor flagged the student. */
    lastFloorAlertAt: timestamp("last_floor_alert_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentUniq: pgUniqueIndex("talent_profiles_student_uniq").on(t.studentId),
    northStarIdx: pgIndex("talent_profiles_north_star_idx").on(
      t.northStarSkillId,
    ),
    publicIdx: pgIndex("talent_profiles_is_public_showcase_idx").on(
      t.isPublicShowcase,
    ),
  }),
);

export type TalentProfile = typeof talentProfiles.$inferSelect;
export type NewTalentProfile = typeof talentProfiles.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * student_talent_zones — Per-student talent/growth zone records
 *
 * One row per (student, skill) where a zone has been detected.
 * Updated nightly by the scoring job (Bayesian update).
 * ──────────────────────────────────────────────────────────── */

export const TALENT_ZONE_TYPE_VALUES = [
  "north_star",
  "talent",
  "growth",
] as const;
export type TalentZoneTypeValue = (typeof TALENT_ZONE_TYPE_VALUES)[number];

export const TALENT_TIER_VALUES = [
  "seedling",
  "bronze",
  "silver",
  "gold",
  "diamond",
] as const;
export type TalentTierValue = (typeof TALENT_TIER_VALUES)[number];

export const studentTalentZones = pgTable(
  "student_talent_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => pgRef(subjectSkills.id), { onDelete: "cascade" }),
    /** Type of zone: north_star (chosen), talent (detected), growth (weak). */
    zoneType: pgText("zone_type").notNull().default("talent"),
    /** Composite talent score 0-1. */
    talentScore: pgReal("talent_score").default(0).notNull(),
    /** Bayesian confidence 0-1 (alpha / (alpha + beta)). */
    confidence: pgReal("confidence").default(0.286).notNull(),
    /** Weekly velocity (mastery delta per week). */
    velocity: pgReal("velocity").default(0).notNull(),
    /** Transfer score 0-1 (success on transfer-tagged questions). */
    transferScore: pgReal("transfer_score").default(0).notNull(),
    /** Joy signal 0-1 (from emotional check-ins + implicit signals). */
    joyScore: pgReal("joy_score").default(0.5).notNull(),
    /** Tier achieved. */
    tier: pgText("tier").default("seedling").notNull(),
    /** Bayesian hyperparameters for Beta-Binomial model. */
    alpha: pgReal("alpha").default(2).notNull(),
    beta: pgReal("beta").default(5).notNull(),
    /** Number of observations feeding the model. */
    observationCount: pgInteger("observation_count").default(0).notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastRecalculatedAt: timestamp("last_recalculated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentSkillUniq: pgUniqueIndex("student_talent_zones_student_skill_uniq").on(
      t.studentId,
      t.skillId,
    ),
    studentIdx: pgIndex("student_talent_zones_student_id_idx").on(t.studentId),
    skillIdx: pgIndex("student_talent_zones_skill_id_idx").on(t.skillId),
    zoneTypeIdx: pgIndex("student_talent_zones_zone_type_idx").on(t.zoneType),
    tierIdx: pgIndex("student_talent_zones_tier_idx").on(t.tier),
  }),
);

export type StudentTalentZone = typeof studentTalentZones.$inferSelect;
export type NewStudentTalentZone = typeof studentTalentZones.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * talent_challenges — Library of advanced challenges
 *
 * Curated by teachers/admins OR created by students (Diamond tier)
 * in the Talent Marketplace.
 * ──────────────────────────────────────────────────────────── */

export const TALENT_CHALLENGE_TYPE_VALUES = [
  "problem_set",
  "project",
  "investigation",
  "creative",
  "competition_prep",
] as const;
export type TalentChallengeTypeValue =
  (typeof TALENT_CHALLENGE_TYPE_VALUES)[number];

export const talentChallenges = pgTable(
  "talent_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => pgRef(subjectSkills.id), { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => pgRef(subjects.id), { onDelete: "cascade" }),
    title: pgText("title").notNull(),
    description: pgText("description").notNull(),
    /** Difficulty 1-10 (3+ levels above the class level for enrichment). */
    difficulty: pgInteger("difficulty").default(5).notNull(),
    /** Estimated minutes to complete. */
    estimatedMinutes: pgInteger("estimated_minutes").default(30).notNull(),
    type: pgText("type").notNull().default("problem_set"),
    /** Tier required to unlock. */
    requiredTier: pgText("required_tier").default("seedling").notNull(),
    /** JSON payload describing the challenge (problem statement, hints, solution). */
    payload: jsonb("payload").$type<
      JsonRecord & {
        problemStatement?: string;
        hints?: string[];
        solution?: string;
        resources?: Array<{ url: string; title: string }>;
        steps?: string[];
      }
    >(),
    /** Optional hint (revealed on request). */
    solutionHint: pgText("solution_hint"),
    /** Who created this challenge. */
    createdBy: uuid("created_by")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** True if created by a student (marketplace). */
    isUserGenerated: pgBoolean("is_user_generated").default(false).notNull(),
    /** Publication status. */
    isPublished: pgBoolean("is_published").default(false).notNull(),
    /** Number of times this challenge has been completed. */
    completionsCount: pgInteger("completions_count").default(0).notNull(),
    /** Average rating 0-5. */
    ratingAvg: pgReal("rating_avg").default(0).notNull(),
    ratingCount: pgInteger("rating_count").default(0).notNull(),
    /** Tags for filtering. */
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
    skillIdx: pgIndex("talent_challenges_skill_id_idx").on(t.skillId),
    subjectIdx: pgIndex("talent_challenges_subject_id_idx").on(t.subjectId),
    typeIdx: pgIndex("talent_challenges_type_idx").on(t.type),
    tierIdx: pgIndex("talent_challenges_required_tier_idx").on(t.requiredTier),
    publishedIdx: pgIndex("talent_challenges_is_published_idx").on(
      t.isPublished,
    ),
    createdByIdx: pgIndex("talent_challenges_created_by_idx").on(t.createdBy),
  }),
);

export type TalentChallenge = typeof talentChallenges.$inferSelect;
export type NewTalentChallenge = typeof talentChallenges.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * talent_tracks — Weekly personalized enrichment plan
 *
 * One row per student per week. Generated on Sunday night.
 * Budget: max 30% of weekly learning time on talent track.
 * ──────────────────────────────────────────────────────────── */

export const talentTracks = pgTable(
  "talent_tracks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** The North Star skill this track is built around. */
    northStarSkillId: uuid("north_star_skill_id")
      .notNull()
      .references(() => pgRef(subjectSkills.id), { onDelete: "cascade" }),
    /** ISO week string "2026-W33". */
    weekKey: pgText("week_key").notNull(),
    isActive: pgBoolean("is_active").default(true).notNull(),
    /** Max minutes per week on the talent track (30% of weekly learning). */
    timeBudgetMinutes: pgInteger("time_budget_minutes").default(90).notNull(),
    /** Challenge IDs proposed this week. */
    enrichmentChallengeIds: uuid("enrichment_challenge_ids")
      .array()
      .default([])
      .notNull(),
    /** Optional cross-disciplinary project challenge. */
    crossDisciplinaryProjectId: uuid("cross_disciplinary_project_id"),
    /** Optional mentor-created challenge. */
    mentorChallengeId: uuid("mentor_challenge_id"),
    /** Optional competition recommended. */
    competitionId: uuid("competition_id"),
    /** Whether the track is paused (floor alert). */
    isPaused: pgBoolean("is_paused").default(false).notNull(),
    /** Reason for pause if any. */
    pauseReason: pgText("pause_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentWeekUniq: pgUniqueIndex("talent_tracks_student_week_uniq").on(
      t.studentId,
      t.weekKey,
    ),
    studentIdx: pgIndex("talent_tracks_student_id_idx").on(t.studentId),
    weekIdx: pgIndex("talent_tracks_week_key_idx").on(t.weekKey),
    northStarIdx: pgIndex("talent_tracks_north_star_idx").on(
      t.northStarSkillId,
    ),
  }),
);

export type TalentTrack = typeof talentTracks.$inferSelect;
export type NewTalentTrack = typeof talentTracks.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * talent_track_progress — Weekly progress snapshot
 * ──────────────────────────────────────────────────────────── */

export const talentTrackProgress = pgTable(
  "talent_track_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    talentTrackId: uuid("talent_track_id")
      .notNull()
      .references(() => pgRef(talentTracks.id), { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    weekKey: pgText("week_key").notNull(),
    challengesCompleted: pgInteger("challenges_completed").default(0).notNull(),
    challengesTotal: pgInteger("challenges_total").default(0).notNull(),
    timeSpentMinutes: pgInteger("time_spent_minutes").default(0).notNull(),
    /** Mastery delta on the North Star over the week. */
    masteryDelta: pgReal("mastery_delta").default(0).notNull(),
    /** Average joy signal this week. */
    joySignal: pgReal("joy_signal").default(0.5).notNull(),
    /** Number of floor breaches this week. */
    floorAlerts: pgInteger("floor_alerts").default(0).notNull(),
    /** Tier at start of week → tier at end of week. */
    tierStart: pgText("tier_start"),
    tierEnd: pgText("tier_end"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    trackIdx: pgIndex("talent_track_progress_track_id_idx").on(
      t.talentTrackId,
    ),
    studentIdx: pgIndex("talent_track_progress_student_id_idx").on(
      t.studentId,
    ),
    weekIdx: pgIndex("talent_track_progress_week_key_idx").on(t.weekKey),
  }),
);

export type TalentTrackProgress = typeof talentTrackProgress.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * talent_challenge_submissions — Student attempts on challenges
 * ──────────────────────────────────────────────────────────── */

export const TALENT_SUBMISSION_STATUS_VALUES = [
  "in_progress",
  "submitted",
  "reviewed",
  "rejected",
] as const;
export type TalentSubmissionStatusValue =
  (typeof TALENT_SUBMISSION_STATUS_VALUES)[number];

export const talentChallengeSubmissions = pgTable(
  "talent_challenge_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => pgRef(talentChallenges.id), { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    status: pgText("status").notNull().default("in_progress"),
    /** Student's answer / work. */
    submission: pgText("submission"),
    /** Optional file IDs attached. */
    fileIds: uuid("file_ids").array().default([]).notNull(),
    /** Time spent in minutes. */
    timeSpentMinutes: pgInteger("time_spent_minutes").default(0).notNull(),
    /** Rating given by the student 0-5. */
    rating: pgInteger("rating"),
    /** Teacher/tutor feedback. */
    feedback: pgText("feedback"),
    reviewedBy: uuid("reviewed_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    challengeIdx: pgIndex(
      "talent_challenge_submissions_challenge_id_idx",
    ).on(t.challengeId),
    studentIdx: pgIndex(
      "talent_challenge_submissions_student_id_idx",
    ).on(t.studentId),
    statusIdx: pgIndex("talent_challenge_submissions_status_idx").on(
      t.status,
    ),
    challengeStudentUniq: pgUniqueIndex(
      "talent_challenge_submissions_challenge_student_uniq",
    ).on(t.challengeId, t.studentId),
  }),
);

export type TalentChallengeSubmission =
  typeof talentChallengeSubmissions.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * mentor_recommendations — Tutor matching suggestions
 * ──────────────────────────────────────────────────────────── */

export const MENTOR_RECO_STATUS_VALUES = [
  "suggested",
  "accepted",
  "rejected",
  "expired",
] as const;
export type MentorRecoStatusValue =
  (typeof MENTOR_RECO_STATUS_VALUES)[number];

export const mentorRecommendations = pgTable(
  "mentor_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Match score 0-1. */
    matchScore: pgReal("match_score").default(0).notNull(),
    status: pgText("status").notNull().default("suggested"),
    /** Human-readable reason. */
    reason: pgText("reason"),
    /** The North Star skill that triggered the match. */
    skillId: uuid("skill_id").references(() => pgRef(subjectSkills.id), {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("mentor_recommendations_student_id_idx").on(
      t.studentId,
    ),
    tutorIdx: pgIndex("mentor_recommendations_tutor_id_idx").on(t.tutorId),
    statusIdx: pgIndex("mentor_recommendations_status_idx").on(t.status),
    studentTutorUniq: pgUniqueIndex(
      "mentor_recommendations_student_tutor_uniq",
    ).on(t.studentId, t.tutorId),
  }),
);

export type MentorRecommendation = typeof mentorRecommendations.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * talent_cohorts — Cross-school groups of same-talent students
 * ──────────────────────────────────────────────────────────── */

export const talentCohorts = pgTable(
  "talent_cohorts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The skill that defines this cohort. */
    skillId: uuid("skill_id")
      .notNull()
      .references(() => pgRef(subjectSkills.id), { onDelete: "cascade" }),
    /** Level filter (e.g. "Tle"). */
    level: pgText("level"),
    /** Display name (auto-generated). */
    name: pgText("name").notNull(),
    /** Optional cohort emoji / icon. */
    icon: pgText("icon"),
    /** Weekly challenge ID for the cohort. */
    currentChallengeId: uuid("current_challenge_id"),
    /** Whether the cohort is active. */
    isActive: pgBoolean("is_active").default(true).notNull(),
    /** Cohort created by (admin or auto). */
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    skillIdx: pgIndex("talent_cohorts_skill_id_idx").on(t.skillId),
    levelIdx: pgIndex("talent_cohorts_level_idx").on(t.level),
    activeIdx: pgIndex("talent_cohorts_is_active_idx").on(t.isActive),
  }),
);

export type TalentCohort = typeof talentCohorts.$inferSelect;

export const talentCohortMembers = pgTable(
  "talent_cohort_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => pgRef(talentCohorts.id), { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    cohortStudentUniq: pgUniqueIndex("talent_cohort_members_uniq").on(
      t.cohortId,
      t.studentId,
    ),
    cohortIdx: pgIndex("talent_cohort_members_cohort_id_idx").on(t.cohortId),
    studentIdx: pgIndex("talent_cohort_members_student_id_idx").on(
      t.studentId,
    ),
  }),
);

export type TalentCohortMember = typeof talentCohortMembers.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * career_matches — NLP matching between North Star and careers
 * ──────────────────────────────────────────────────────────── */

export const careerMatches = pgTable(
  "career_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Career code (ROME / O*NET-SOC). */
    careerCode: pgText("career_code").notNull(),
    /** Career title. */
    careerTitle: pgText("career_title").notNull(),
    /** Match score 0-1. */
    matchScore: pgReal("match_score").default(0).notNull(),
    /** Reason for the match (NLP explanation). */
    reason: pgText("reason"),
    /** The North Star skill that drove the match. */
    skillId: uuid("skill_id").references(() => pgRef(subjectSkills.id), {
      onDelete: "set null",
    }),
    /** Whether the student bookmarked this career. */
    isBookmarked: pgBoolean("is_bookmarked").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("career_matches_student_id_idx").on(t.studentId),
    careerIdx: pgIndex("career_matches_career_code_idx").on(t.careerCode),
    bookmarkedIdx: pgIndex("career_matches_is_bookmarked_idx").on(
      t.isBookmarked,
    ),
  }),
);

export type CareerMatch = typeof careerMatches.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * talent_showcase_items — Public portfolio items
 * ──────────────────────────────────────────────────────────── */

export const talentShowcaseItems = pgTable(
  "talent_showcase_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    title: pgText("title").notNull(),
    description: pgText("description"),
    /** Type of showcase item (project, achievement, challenge solution). */
    type: pgText("type").notNull().default("project"),
    /** Optional link to a talent challenge submission. */
    submissionId: uuid("submission_id"),
    /** Optional file IDs (images, documents). */
    fileIds: uuid("file_ids").array().default([]).notNull(),
    /** Optional external URL. */
    externalUrl: pgText("external_url"),
    /** Skill highlighted. */
    skillId: uuid("skill_id").references(() => pgRef(subjectSkills.id), {
      onDelete: "set null",
    }),
    /** Number of likes received. */
    likesCount: pgInteger("likes_count").default(0).notNull(),
    /** Whether the item is published (visible publicly). */
    isPublished: pgBoolean("is_published").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("talent_showcase_items_student_id_idx").on(
      t.studentId,
    ),
    publishedIdx: pgIndex("talent_showcase_items_is_published_idx").on(
      t.isPublished,
    ),
    skillIdx: pgIndex("talent_showcase_items_skill_id_idx").on(t.skillId),
  }),
);

export type TalentShowcaseItem = typeof talentShowcaseItems.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * socratic_conversations — AI mentor chat history
 * ──────────────────────────────────────────────────────────── */

export const socraticConversations = pgTable(
  "socratic_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** The skill the conversation is about. */
    skillId: uuid("skill_id").references(() => pgRef(subjectSkills.id), {
      onDelete: "set null",
    }),
    /** Optional link to a challenge being discussed. */
    challengeId: uuid("challenge_id"),
    /** Conversation title (auto-generated from first message). */
    title: pgText("title"),
    /** JSON array of messages: [{ role, content, timestamp }]. */
    messages: jsonb("messages").$type<
      JsonRecord & {
        history?: Array<{
          role: "user" | "assistant";
          content: string;
          timestamp: string;
        }>;
      }
    >(),
    /** Number of messages exchanged. */
    messageCount: pgInteger("message_count").default(0).notNull(),
    /** Whether the conversation is active. */
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
    studentIdx: pgIndex("socratic_conversations_student_id_idx").on(
      t.studentId,
    ),
    skillIdx: pgIndex("socratic_conversations_skill_id_idx").on(t.skillId),
    activeIdx: pgIndex("socratic_conversations_is_active_idx").on(
      t.isActive,
    ),
  }),
);

export type SocraticConversation = typeof socraticConversations.$inferSelect;

/* ─────────────────────────────────────────────────────────────
 * floor_alerts — Foundation Floor Monitor alerts
 *
 * Created when a student's mastery on non-talent skills drops
 * below the 65% threshold. Auto-resolves when mastery recovers.
 * ──────────────────────────────────────────────────────────── */

export const FLOOR_ALERT_STATUS_VALUES = [
  "active",
  "resolved",
  "intervention_sent",
] as const;
export type FloorAlertStatusValue =
  (typeof FLOOR_ALERT_STATUS_VALUES)[number];

export const floorAlerts = pgTable(
  "floor_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** The skill that breached the floor. */
    skillId: uuid("skill_id"),
    /** Mastery at the time of the alert. */
    masteryAtAlert: pgReal("mastery_at_alert").notNull(),
    /** Threshold that was breached (default 65). */
    threshold: pgReal("threshold").default(65).notNull(),
    status: pgText("status").notNull().default("active"),
    /** Number of consecutive breaches. */
    breachCount: pgInteger("breach_count").default(1).notNull(),
    /** Whether the talent track was paused as a result. */
    pausedTalentTrack: pgBoolean("paused_talent_track")
      .default(false)
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    studentIdx: pgIndex("floor_alerts_student_id_idx").on(t.studentId),
    skillIdx: pgIndex("floor_alerts_skill_id_idx").on(t.skillId),
    statusIdx: pgIndex("floor_alerts_status_idx").on(t.status),
  }),
);

export type FloorAlert = typeof floorAlerts.$inferSelect;
