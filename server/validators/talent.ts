/**
 * §10.4 — Talent system validators (Zod v4).
 */

import { z } from "zod";

import {
  TDA_PHASE_VALUES,
  TDA_STATUS_VALUES,
  TALENT_ZONE_TYPE_VALUES,
  TALENT_TIER_VALUES,
  TALENT_CHALLENGE_TYPE_VALUES,
  TALENT_SUBMISSION_STATUS_VALUES,
  MENTOR_RECO_STATUS_VALUES,
  FLOOR_ALERT_STATUS_VALUES,
} from "@/server/db/schema/talent";

/* ── TDA (Talent Discovery Assessment) ────────────────────── */

export const startTdaSchema = z.object({}).default({});

export const submitTdaAnswerSchema = z.object({
  sessionId: z.uuid(),
  phase: z.enum(TDA_PHASE_VALUES),
  domain: z.string().min(1).max(60),
  skillId: z.uuid().optional(),
  questionId: z.uuid().optional(),
  answer: z.string().max(10000).optional(),
  isCorrect: z.boolean().optional(),
  difficulty: z.number().min(0).max(10).optional(),
  timeSpentSec: z.number().int().min(0).max(3600).default(0),
});

export const advanceTdaPhaseSchema = z.object({
  sessionId: z.uuid(),
  /** The phase that was just completed (server validates the transition). */
  completedPhase: z.enum(TDA_PHASE_VALUES),
  /** Phase-specific summary data to persist on the session. */
  phaseData: z.record(z.string(), z.unknown()).optional(),
});

export const completeTdaSchema = z.object({
  sessionId: z.uuid(),
  /** Final phase data (creativity / motivation results). */
  finalPhaseData: z.record(z.string(), z.unknown()).optional(),
});

/* ── Talent profile ────────────────────────────────────────── */

export const chooseNorthStarSchema = z.object({
  skillId: z.uuid(),
  /** Optional reason (free text) — saved in talent_profile audit log. */
  reason: z.string().max(500).optional(),
});

export const updateTalentProfileConsentSchema = z.object({
  isPublicShowcase: z.boolean().optional(),
  mentorMatchConsent: z.boolean().optional(),
  cohortMatchConsent: z.boolean().optional(),
  aiMentorConsent: z.boolean().optional(),
});

/* ── Talent challenges ────────────────────────────────────── */

export const createTalentChallengeSchema = z.object({
  skillId: z.uuid(),
  subjectId: z.uuid(),
  title: z.string().min(3, "Title too short").max(200),
  description: z.string().min(10, "Description too short").max(5000),
  difficulty: z.number().int().min(1).max(10).default(5),
  estimatedMinutes: z.number().int().min(5).max(240).default(30),
  type: z.enum(TALENT_CHALLENGE_TYPE_VALUES).default("problem_set"),
  requiredTier: z.enum([
    "seedling",
    "bronze",
    "silver",
    "gold",
    "diamond",
  ]).default("seedling"),
  payload: z
    .record(z.string(), z.unknown())
    .optional(),
  solutionHint: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
});

export const updateTalentChallengeSchema = z.object({
  id: z.uuid(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  difficulty: z.number().int().min(1).max(10).optional(),
  estimatedMinutes: z.number().int().min(5).max(240).optional(),
  type: z.enum(TALENT_CHALLENGE_TYPE_VALUES).optional(),
  requiredTier: z.enum([
    "seedling",
    "bronze",
    "silver",
    "gold",
    "diamond",
  ]).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  solutionHint: z.string().max(2000).nullable().optional(),
  isPublished: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
});

export const listTalentChallengesSchema = z.object({
  skillId: z.uuid().optional(),
  subjectId: z.uuid().optional(),
  type: z.enum(TALENT_CHALLENGE_TYPE_VALUES).optional(),
  requiredTier: z
    .enum(["seedling", "bronze", "silver", "gold", "diamond"])
    .optional(),
  isPublished: z.boolean().optional(),
  createdBy: z.uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/* ── Talent challenge submissions ──────────────────────────── */

export const startChallengeSchema = z.object({
  challengeId: z.uuid(),
});

export const submitChallengeSchema = z.object({
  submissionId: z.uuid(),
  submission: z.string().max(50000),
  fileIds: z.array(z.uuid()).max(10).default([]),
  timeSpentMinutes: z.number().int().min(0).max(480).default(0),
  rating: z.number().int().min(0).max(5).optional(),
});

export const reviewChallengeSubmissionSchema = z.object({
  submissionId: z.uuid(),
  feedback: z.string().max(5000).optional(),
  status: z.enum(["reviewed", "rejected"]),
});

/* ── Talent track ──────────────────────────────────────────── */

export const generateWeeklyTalentTrackSchema = z.object({
  /** Force regenerate even if a track already exists for the week. */
  force: z.boolean().default(false),
});

export const pauseTalentTrackSchema = z.object({
  trackId: z.uuid(),
  reason: z.string().max(500).optional(),
});

export const resumeTalentTrackSchema = z.object({
  trackId: z.uuid(),
});

/* ── Mentor recommendations ───────────────────────────────── */

export const respondMentorRecommendationSchema = z.object({
  recommendationId: z.uuid(),
  status: z.enum(["accepted", "rejected"]),
});

/* ── Career matches ────────────────────────────────────────── */

export const bookmarkCareerSchema = z.object({
  careerMatchId: z.uuid(),
  isBookmarked: z.boolean(),
});

/* ── Showcase items ────────────────────────────────────────── */

export const createShowcaseItemSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  type: z.string().max(40).default("project"),
  submissionId: z.uuid().optional(),
  fileIds: z.array(z.uuid()).max(10).default([]),
  externalUrl: z.string().url().max(2048).optional(),
  skillId: z.uuid().optional(),
  isPublished: z.boolean().default(false),
});

export const updateShowcaseItemSchema = z.object({
  id: z.uuid(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  externalUrl: z.string().url().max(2048).nullable().optional(),
  skillId: z.uuid().nullable().optional(),
  isPublished: z.boolean().optional(),
});

/* ── Socratic conversations ───────────────────────────────── */

export const startSocraticConversationSchema = z.object({
  skillId: z.uuid().optional(),
  challengeId: z.uuid().optional(),
  title: z.string().max(200).optional(),
});

export const sendSocraticMessageSchema = z.object({
  conversationId: z.uuid(),
  message: z.string().min(1).max(4000),
});

/* ── Cohorts ──────────────────────────────────────────────── */

export const joinTalentCohortSchema = z.object({
  cohortId: z.uuid(),
});

export const leaveTalentCohortSchema = z.object({
  cohortId: z.uuid(),
});

/* ── Floor alerts (admin) ─────────────────────────────────── */

export const resolveFloorAlertSchema = z.object({
  alertId: z.uuid(),
  /** Optional admin note. */
  note: z.string().max(1000).optional(),
});

/* ── Types ────────────────────────────────────────────────── */

export type StartTdaInput = z.infer<typeof startTdaSchema>;
export type SubmitTdaAnswerInput = z.infer<typeof submitTdaAnswerSchema>;
export type AdvanceTdaPhaseInput = z.infer<typeof advanceTdaPhaseSchema>;
export type CompleteTdaInput = z.infer<typeof completeTdaSchema>;
export type ChooseNorthStarInput = z.infer<typeof chooseNorthStarSchema>;
export type UpdateTalentProfileConsentInput = z.infer<
  typeof updateTalentProfileConsentSchema
>;
export type CreateTalentChallengeInput = z.infer<
  typeof createTalentChallengeSchema
>;
export type UpdateTalentChallengeInput = z.infer<
  typeof updateTalentChallengeSchema
>;
export type ListTalentChallengesInput = z.infer<
  typeof listTalentChallengesSchema
>;
export type StartChallengeInput = z.infer<typeof startChallengeSchema>;
export type SubmitChallengeInput = z.infer<typeof submitChallengeSchema>;
export type ReviewChallengeSubmissionInput = z.infer<
  typeof reviewChallengeSubmissionSchema
>;
export type GenerateWeeklyTalentTrackInput = z.infer<
  typeof generateWeeklyTalentTrackSchema
>;
export type PauseTalentTrackInput = z.infer<typeof pauseTalentTrackSchema>;
export type ResumeTalentTrackInput = z.infer<typeof resumeTalentTrackSchema>;
export type RespondMentorRecommendationInput = z.infer<
  typeof respondMentorRecommendationSchema
>;
export type BookmarkCareerInput = z.infer<typeof bookmarkCareerSchema>;
export type CreateShowcaseItemInput = z.infer<typeof createShowcaseItemSchema>;
export type UpdateShowcaseItemInput = z.infer<typeof updateShowcaseItemSchema>;
export type StartSocraticConversationInput = z.infer<
  typeof startSocraticConversationSchema
>;
export type SendSocraticMessageInput = z.infer<
  typeof sendSocraticMessageSchema
>;
export type JoinTalentCohortInput = z.infer<typeof joinTalentCohortSchema>;
export type LeaveTalentCohortInput = z.infer<typeof leaveTalentCohortSchema>;
export type ResolveFloorAlertInput = z.infer<typeof resolveFloorAlertSchema>;
