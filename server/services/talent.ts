/**
 * §10.4 — Talent orchestration service.
 *
 * Wraps the TDA (Talent Discovery Assessment), profile management,
 * weekly Talent Track generation, and challenge/submission flows.
 */

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  subjects,
  subjectSkills,
  talentAssessmentSessions,
  talentAssessmentAnswers,
  talentProfiles,
  studentTalentZones,
  talentChallenges,
  talentChallengeSubmissions,
  talentTracks,
  talentTrackProgress,
  talentCohorts,
  talentCohortMembers,
  talentShowcaseItems,
  floorAlerts,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

import {
  computeTalentScore,
  recalculateStudentTalentZones,
  tierForScore,
  TIER_THRESHOLDS,
} from "@/server/services/talent-scoring";
import { recommendChallengesForSkill } from "@/server/services/talent-recommender";
import { checkStudentFloor } from "@/server/services/foundation-monitor";

/* ── Types ─────────────────────────────────────────────────── */

export type TdaSessionWithAnswers = TalentAssessmentSession & {
  answers: TalentAssessmentAnswer[];
};

// Re-import types so callers can `import type { ... } from "@/server/services/talent"`.
import type {
  TalentAssessmentSession,
  TalentAssessmentAnswer,
  TalentProfile,
  StudentTalentZone,
  TalentChallenge,
  TalentChallengeSubmission,
  TalentTrack,
} from "@/server/db/schema/talent";
import type { Subject, SubjectSkill } from "@/server/db/schema/schools";
import type { User } from "@/server/db/schema/users";

export type TalentProfileWithRelations = Awaited<
  ReturnType<typeof getTalentProfile>
>;

export type TalentChallengeWithRelations = TalentChallenge & {
  subject: Pick<Subject, "id" | "name" | "code">;
  skill: Pick<SubjectSkill, "id" | "name" | "difficulty">;
  creator: Pick<User, "id" | "firstName" | "lastName"> | null;
};

export type TalentTrackWithRelations = TalentTrack & {
  northStar: Pick<SubjectSkill, "id" | "name" | "difficulty"> | null;
  challenges: TalentChallenge[];
  progress: Array<{
    challengeId: string;
    status: string;
    submittedAt: Date | null;
  }>;
};

/* ── TDA — Talent Discovery Assessment ─────────────────────── */

/**
 * Start a new TDA session for a student. If an in-progress session
 * already exists, return it.
 */
export async function startTdaSession(
  studentId: string,
): Promise<TalentAssessmentSession> {
  const db = await getDb();

  // Check for an in-progress session.
  const existing = await db
    .select()
    .from(talentAssessmentSessions)
    .where(
      and(
        eq(talentAssessmentSessions.studentId, studentId),
        eq(talentAssessmentSessions.status, "in_progress"),
      ),
    )
    .limit(1);
  if (existing.at(0)) return existing[0]!;

  const [created] = await db
    .insert(talentAssessmentSessions)
    .values({
      studentId,
      status: "in_progress",
      currentPhase: "cognitive",
      phaseData: {},
    })
    .returning();
  if (!created) throw AppError.internal("Failed to start TDA session");
  return created;
}

/**
 * Get a TDA session by id (with its answers).
 */
export async function getTdaSession(
  sessionId: string,
): Promise<TdaSessionWithAnswers | null> {
  const db = await getDb();
  const sessions = await db
    .select()
    .from(talentAssessmentSessions)
    .where(eq(talentAssessmentSessions.id, sessionId))
    .limit(1);
  const session = sessions.at(0);
  if (!session) return null;

  const answers = await db
    .select()
    .from(talentAssessmentAnswers)
    .where(eq(talentAssessmentAnswers.sessionId, sessionId))
    .orderBy(asc(talentAssessmentAnswers.createdAt));
  return { ...session, answers };
}

/**
 * Submit one TDA answer. Updates the session's totals + IRT ability estimate.
 */
export async function submitTdaAnswer(
  input: {
    sessionId: string;
    studentId: string;
    phase: string;
    domain: string;
    skillId?: string;
    questionId?: string;
    answer?: string;
    isCorrect?: boolean;
    difficulty?: number;
    timeSpentSec: number;
  },
): Promise<TalentAssessmentAnswer> {
  const db = await getDb();

  // IRT 2PL ability estimate (simplified): if correct, ability = difficulty + 1;
  // if incorrect, ability = difficulty - 1.
  const abilityEstimate =
    input.isCorrect !== undefined && input.difficulty !== undefined
      ? input.isCorrect
        ? input.difficulty + 1
        : Math.max(0, input.difficulty - 1)
      : undefined;

  const [created] = await db
    .insert(talentAssessmentAnswers)
    .values({
      sessionId: input.sessionId,
      studentId: input.studentId,
      phase: input.phase,
      domain: input.domain,
      skillId: input.skillId,
      questionId: input.questionId,
      answer: input.answer,
      isCorrect: input.isCorrect,
      difficulty: input.difficulty,
      timeSpentSec: input.timeSpentSec,
      abilityEstimate,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to save TDA answer");

  // Update session totals.
  const session = await db
    .select()
    .from(talentAssessmentSessions)
    .where(eq(talentAssessmentSessions.id, input.sessionId))
    .limit(1);
  if (session.at(0)) {
    await db
      .update(talentAssessmentSessions)
      .set({
        totalQuestions: session[0]!.totalQuestions + 1,
        correctAnswers:
          session[0]!.correctAnswers + (input.isCorrect === true ? 1 : 0),
        timeSpentSec: session[0]!.timeSpentSec + input.timeSpentSec,
      })
      .where(eq(talentAssessmentSessions.id, input.sessionId));
  }

  return created;
}

/**
 * Advance to the next phase. Persists the phase data on the session.
 */
export async function advanceTdaPhase(
  sessionId: string,
  completedPhase: string,
  phaseData?: Record<string, unknown>,
): Promise<TalentAssessmentSession> {
  const db = await getDb();
  const session = await db
    .select()
    .from(talentAssessmentSessions)
    .where(eq(talentAssessmentSessions.id, sessionId))
    .limit(1);
  if (!session.at(0)) throw AppError.notFound("TDA session not found");

  const order = ["cognitive", "multi_subject", "creativity", "motivation", "completed"];
  const idx = order.indexOf(completedPhase);
  const nextPhase = order[Math.min(idx + 1, order.length - 1)]!;

  const existingPhaseData =
    (session[0]!.phaseData as Record<string, unknown> | null) ?? {};
  const mergedPhaseData = phaseData
    ? { ...existingPhaseData, [completedPhase]: phaseData }
    : existingPhaseData;

  const [updated] = await db
    .update(talentAssessmentSessions)
    .set({
      currentPhase: nextPhase,
      phaseData: mergedPhaseData,
    })
    .where(eq(talentAssessmentSessions.id, sessionId))
    .returning();
  if (!updated) throw AppError.internal("Failed to advance TDA phase");
  return updated;
}

/**
 * Complete the TDA: compute the Talent DNA Card from all answers,
 * upsert a talent_profile, and detect initial talent zones.
 */
export async function completeTdaSession(
  sessionId: string,
  finalPhaseData?: Record<string, unknown>,
): Promise<TalentProfile> {
  const db = await getDb();
  const sessionWithAnswers = await getTdaSession(sessionId);
  if (!sessionWithAnswers) throw AppError.notFound("TDA session not found");

  const { studentId, answers } = sessionWithAnswers;

  // 1. Compute cognitive scores per domain.
  const cognitiveScores: Record<string, number> = {
    numerical: 0,
    verbal: 0,
    spatial: 0,
    logic: 0,
    memory: 0,
  };
  for (const ans of answers.filter((a) => a.phase === "cognitive")) {
    if (ans.isCorrect === null || ans.isCorrect === undefined) continue;
    const score = ans.isCorrect ? 100 : 0;
    cognitiveScores[ans.domain] =
      (cognitiveScores[ans.domain] ?? 0) + score;
  }
  // Normalize per domain (divide by count).
  for (const domain of Object.keys(cognitiveScores)) {
    const count = answers.filter(
      (a) => a.phase === "cognitive" && a.domain === domain,
    ).length;
    if (count > 0) cognitiveScores[domain] = cognitiveScores[domain]! / count;
  }

  // 2. Compute domain scores per subject (multi_subject phase).
  const domainScores: Record<string, number> = {};
  for (const ans of answers.filter((a) => a.phase === "multi_subject")) {
    if (ans.isCorrect === null || ans.isCorrect === undefined) continue;
    // Group by skill's subject — but we don't have the subject here directly.
    // Use the domain as a proxy (domain = subjectId in this phase).
    const key = ans.domain;
    domainScores[key] = (domainScores[key] ?? 0) + (ans.isCorrect ? 100 : 0);
  }
  for (const key of Object.keys(domainScores)) {
    const count = answers.filter(
      (a) => a.phase === "multi_subject" && a.domain === key,
    ).length;
    if (count > 0) domainScores[key] = domainScores[key]! / count;
  }

  // 3. Creativity score from phase data.
  const creativityData =
    (sessionWithAnswers.phaseData?.creativity as { score?: number }) ?? {};
  const creativityScore = creativityData.score ?? 50;

  // 4. Engagement score (from motivation phase).
  const motivationData =
    (sessionWithAnswers.phaseData?.motivation as {
      engagementScore?: number;
    }) ?? {};
  const engagementScore = motivationData.engagementScore ?? 50;

  // 5. Detect zones: top 3 domains by score = talent, bottom 2 = growth.
  const sortedCognitive = Object.entries(cognitiveScores).sort(
    ([, a], [, b]) => b - a,
  );
  const detectedZones = sortedCognitive
    .slice(0, 3)
    .filter(([, s]) => s >= 60)
    .map(([d]) => d);
  const growthZones = sortedCognitive
    .slice(-2)
    .filter(([, s]) => s < 50)
    .map(([d]) => d);

  // 6. Compute overall talent score (avg of top 3 cognitive + creativity + engagement).
  const topScores = sortedCognitive
    .slice(0, 3)
    .map(([, s]) => s / 100);
  const overallTalentScore =
    topScores.length > 0
      ? (topScores.reduce((s, v) => s + v, 0) / topScores.length +
          creativityScore / 100 +
          engagementScore / 100) /
        3
      : 0;

  // 7. Mark session as completed.
  const phaseData = finalPhaseData
    ? { ...sessionWithAnswers.phaseData, motivation: finalPhaseData }
    : sessionWithAnswers.phaseData;
  await db
    .update(talentAssessmentSessions)
    .set({
      status: "completed",
      currentPhase: "completed",
      completedAt: new Date(),
      phaseData,
    })
    .where(eq(talentAssessmentSessions.id, sessionId));

  // 8. Upsert talent_profile.
  const existingProfile = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.studentId, studentId))
    .limit(1);

  let profile: TalentProfile;
  if (existingProfile.at(0)) {
    const [updated] = await db
      .update(talentProfiles)
      .set({
        version: existingProfile[0]!.version + 1,
        cognitiveScores,
        domainScores,
        creativityScore,
        engagementScore,
        detectedZones,
        growthZones,
        overallTalentScore,
        assessmentSessionId: sessionId,
        updatedAt: new Date(),
      })
      .where(eq(talentProfiles.id, existingProfile[0]!.id))
      .returning();
    profile = updated!;
  } else {
    const [created] = await db
      .insert(talentProfiles)
      .values({
        studentId,
        cognitiveScores,
        domainScores,
        creativityScore,
        engagementScore,
        detectedZones,
        growthZones,
        overallTalentScore,
        assessmentSessionId: sessionId,
      })
      .returning();
    profile = created!;
  }

  // 9. Trigger a talent zone recalculation (in the background).
  // This populates student_talent_zones from existing learning data.
  try {
    await recalculateStudentTalentZones(studentId);
  } catch (err) {
    logger.warn("Talent zone recalculation failed (non-blocking)", {
      error: String(err),
      studentId,
    });
  }

  return profile;
}

/* ── Talent profile ────────────────────────────────────────── */

export async function getTalentProfile(
  studentId: string,
): Promise<
  | (TalentProfile & {
      northStar: Pick<SubjectSkill, "id" | "name" | "difficulty"> | null;
      zones: StudentTalentZone[];
    })
  | null
> {
  const db = await getDb();
  const profiles = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.studentId, studentId))
    .limit(1);
  const profile = profiles.at(0);
  if (!profile) return null;

  // Fetch the North Star skill info.
  let northStar: Pick<SubjectSkill, "id" | "name" | "difficulty"> | null = null;
  if (profile.northStarSkillId) {
    const skillRows = await db
      .select({
        id: subjectSkills.id,
        name: subjectSkills.name,
        difficulty: subjectSkills.difficulty,
      })
      .from(subjectSkills)
      .where(eq(subjectSkills.id, profile.northStarSkillId))
      .limit(1);
    northStar = skillRows.at(0) ?? null;
  }

  // Fetch zones.
  const zones = await db
    .select()
    .from(studentTalentZones)
    .where(eq(studentTalentZones.studentId, studentId))
    .orderBy(desc(studentTalentZones.talentScore));

  return { ...profile, northStar, zones };
}

/**
 * Choose the North Star skill. Sets the student's chosen talent to
 * maximize.
 */
export async function chooseNorthStar(
  studentId: string,
  skillId: string,
): Promise<void> {
  const db = await getDb();

  // Verify the skill exists.
  const skill = await db
    .select({ id: subjectSkills.id })
    .from(subjectSkills)
    .where(eq(subjectSkills.id, skillId))
    .limit(1);
  if (!skill.at(0)) throw AppError.notFound("Skill not found");

  // Update the profile.
  const existing = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.studentId, studentId))
    .limit(1);
  if (!existing.at(0)) throw AppError.notFound("Talent profile not found — complete the TDA first");

  await db
    .update(talentProfiles)
    .set({ northStarSkillId: skillId, updatedAt: new Date() })
    .where(eq(talentProfiles.id, existing[0]!.id));

  // Upsert the zone as 'north_star'.
  const zoneExisting = await db
    .select()
    .from(studentTalentZones)
    .where(
      and(
        eq(studentTalentZones.studentId, studentId),
        eq(studentTalentZones.skillId, skillId),
      ),
    )
    .limit(1);
  if (zoneExisting.at(0)) {
    await db
      .update(studentTalentZones)
      .set({ zoneType: "north_star", updatedAt: new Date() })
      .where(eq(studentTalentZones.id, zoneExisting[0]!.id));
  } else {
    await db.insert(studentTalentZones).values({
      studentId,
      skillId,
      zoneType: "north_star",
      talentScore: 0,
      tier: "seedling",
    });
  }
}

/* ── Weekly Talent Track ──────────────────────────────────── */

function getWeekKey(date = new Date()): string {
  // ISO week key: "2026-W33"
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Generate the weekly Talent Track for a student.
 * - Picks 2-3 enrichment challenges via the MAB recommender
 * - Optionally attaches a cross-disciplinary project (Phase 3)
 * - Respects the 30% time budget
 */
export async function generateWeeklyTalentTrack(
  studentId: string,
  force = false,
): Promise<TalentTrack | null> {
  const db = await getDb();

  const profile = await getTalentProfile(studentId);
  if (!profile) throw AppError.notFound("Talent profile not found");
  if (!profile.northStarSkillId) {
    throw AppError.validation("Choose a North Star skill first");
  }

  const weekKey = getWeekKey();

  // Check for an existing track this week.
  const existing = await db
    .select()
    .from(talentTracks)
    .where(
      and(
        eq(talentTracks.studentId, studentId),
        eq(talentTracks.weekKey, weekKey),
      ),
    )
    .limit(1);
  if (existing.at(0) && !force) return existing[0]!;
  if (existing.at(0) && force) {
    await db
      .delete(talentTracks)
      .where(eq(talentTracks.id, existing[0]!.id));
  }

  // Check foundation floor — don't generate a new track if the floor
  // is currently breached.
  const floorCheck = await checkStudentFloor(studentId);
  const isPaused = floorCheck.shouldPauseTalentTrack;

  // Recommend challenges.
  const recommendations = await recommendChallengesForSkill(
    studentId,
    profile.northStarSkillId,
    3,
    profile.northStarTier as "seedling" | "bronze" | "silver" | "gold" | "diamond",
  );

  const challengeIds = recommendations.slice(0, 3).map((r) => r.challenge.id);
  const totalEstimatedMinutes = recommendations
    .slice(0, 3)
    .reduce((s, r) => s + r.challenge.estimatedMinutes, 0);

  // Time budget: max 90 minutes (30% of a 5-hour weekly learning budget).
  const timeBudgetMinutes = Math.min(90, Math.max(45, totalEstimatedMinutes));

  const [track] = await db
    .insert(talentTracks)
    .values({
      studentId,
      northStarSkillId: profile.northStarSkillId,
      weekKey,
      isPaused,
      pauseReason: isPaused
        ? "Foundation floor breached — recovery plan in progress"
        : null,
      timeBudgetMinutes,
      enrichmentChallengeIds: challengeIds,
    })
    .returning();

  if (!track) throw AppError.internal("Failed to generate talent track");
  return track;
}

/**
 * Get the current week's Talent Track with full relations.
 */
export async function getCurrentTalentTrack(
  studentId: string,
): Promise<TalentTrackWithRelations | null> {
  const db = await getDb();
  const weekKey = getWeekKey();
  const tracks = await db
    .select()
    .from(talentTracks)
    .where(
      and(
        eq(talentTracks.studentId, studentId),
        eq(talentTracks.weekKey, weekKey),
      ),
    )
    .limit(1);
  const track = tracks.at(0);
  if (!track) return null;

  // Fetch North Star skill.
  const northStar = await db
    .select({
      id: subjectSkills.id,
      name: subjectSkills.name,
      difficulty: subjectSkills.difficulty,
    })
    .from(subjectSkills)
    .where(eq(subjectSkills.id, track.northStarSkillId))
    .limit(1);

  // Fetch challenges.
  let challenges: TalentChallenge[] = [];
  if (track.enrichmentChallengeIds.length > 0) {
    challenges = await db
      .select()
      .from(talentChallenges)
      .where(inArray(talentChallenges.id, track.enrichmentChallengeIds));
  }

  // Fetch progress (submissions for these challenges).
  const submissions = await db
    .select({
      challengeId: talentChallengeSubmissions.challengeId,
      status: talentChallengeSubmissions.status,
      submittedAt: talentChallengeSubmissions.submittedAt,
    })
    .from(talentChallengeSubmissions)
    .where(
      and(
        eq(talentChallengeSubmissions.studentId, studentId),
        inArray(
          talentChallengeSubmissions.challengeId,
          track.enrichmentChallengeIds,
        ),
      ),
    );

  return {
    ...track,
    northStar: northStar.at(0) ?? null,
    challenges,
    progress: submissions,
  };
}

/* ── Talent challenges ─────────────────────────────────────── */

export async function listTalentChallenges(
  filters: {
    skillId?: string;
    subjectId?: string;
    type?: string;
    requiredTier?: string;
    isPublished?: boolean;
    createdBy?: string;
    search?: string;
    page: number;
    pageSize: number;
  },
): Promise<{ items: TalentChallengeWithRelations[]; total: number }> {
  const db = await getDb();

  const conditions = [];
  if (filters.skillId) conditions.push(eq(talentChallenges.skillId, filters.skillId));
  if (filters.subjectId) conditions.push(eq(talentChallenges.subjectId, filters.subjectId));
  if (filters.type) conditions.push(eq(talentChallenges.type, filters.type));
  if (filters.requiredTier)
    conditions.push(eq(talentChallenges.requiredTier, filters.requiredTier));
  if (filters.isPublished !== undefined)
    conditions.push(eq(talentChallenges.isPublished, filters.isPublished));
  if (filters.createdBy)
    conditions.push(eq(talentChallenges.createdBy, filters.createdBy));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      challenge: talentChallenges,
      subject: subjects,
      skill: subjectSkills,
      creator: users,
    })
    .from(talentChallenges)
    .leftJoin(subjects, eq(subjects.id, talentChallenges.subjectId))
    .leftJoin(subjectSkills, eq(subjectSkills.id, talentChallenges.skillId))
    .leftJoin(users, eq(users.id, talentChallenges.createdBy))
    .where(where)
    .orderBy(desc(talentChallenges.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const items: TalentChallengeWithRelations[] = rows.map((r) => ({
    ...r.challenge,
    subject: r.subject
      ? { id: r.subject.id, name: r.subject.name, code: r.subject.code }
      : { id: "", name: "Unknown", code: "?" },
    skill: r.skill
      ? { id: r.skill.id, name: r.skill.name, difficulty: r.skill.difficulty }
      : { id: "", name: "Unknown", difficulty: "medium" },
    creator: r.creator
      ? { id: r.creator.id, firstName: r.creator.firstName, lastName: r.creator.lastName }
      : null,
  }));

  return { items, total: items.length };
}

export async function getTalentChallenge(
  id: string,
): Promise<TalentChallengeWithRelations | null> {
  const db = await getDb();
  const rows = await db
    .select({
      challenge: talentChallenges,
      subject: subjects,
      skill: subjectSkills,
      creator: users,
    })
    .from(talentChallenges)
    .leftJoin(subjects, eq(subjects.id, talentChallenges.subjectId))
    .leftJoin(subjectSkills, eq(subjectSkills.id, talentChallenges.skillId))
    .leftJoin(users, eq(users.id, talentChallenges.createdBy))
    .where(eq(talentChallenges.id, id))
    .limit(1);
  const r = rows.at(0);
  if (!r) return null;
  return {
    ...r.challenge,
    subject: r.subject
      ? { id: r.subject.id, name: r.subject.name, code: r.subject.code }
      : { id: "", name: "Unknown", code: "?" },
    skill: r.skill
      ? { id: r.skill.id, name: r.skill.name, difficulty: r.skill.difficulty }
      : { id: "", name: "Unknown", difficulty: "medium" },
    creator: r.creator
      ? { id: r.creator.id, firstName: r.creator.firstName, lastName: r.creator.lastName }
      : null,
  };
}

export async function createTalentChallenge(
  input: {
    skillId: string;
    subjectId: string;
    title: string;
    description: string;
    difficulty: number;
    estimatedMinutes: number;
    type: string;
    requiredTier: string;
    payload?: Record<string, unknown>;
    solutionHint?: string;
    tags: string[];
  },
  creatorId: string,
): Promise<TalentChallenge> {
  const db = await getDb();
  const [created] = await db
    .insert(talentChallenges)
    .values({
      ...input,
      createdBy: creatorId,
      isUserGenerated: false,
      isPublished: false,
      payload: input.payload ?? null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create challenge");
  return created;
}

/* ── Challenge submissions ─────────────────────────────────── */

export async function startChallenge(
  challengeId: string,
  studentId: string,
): Promise<TalentChallengeSubmission> {
  const db = await getDb();
  // Check for an existing in-progress submission.
  const existing = await db
    .select()
    .from(talentChallengeSubmissions)
    .where(
      and(
        eq(talentChallengeSubmissions.challengeId, challengeId),
        eq(talentChallengeSubmissions.studentId, studentId),
      ),
    )
    .limit(1);
  if (existing.at(0) && existing[0]!.status === "in_progress") {
    return existing[0]!;
  }
  if (existing.at(0)) {
    // Already submitted — return the existing row.
    return existing[0]!;
  }

  const [created] = await db
    .insert(talentChallengeSubmissions)
    .values({
      challengeId,
      studentId,
      status: "in_progress",
    })
    .returning();
  if (!created) throw AppError.internal("Failed to start challenge");
  return created;
}

export async function submitChallenge(
  submissionId: string,
  submission: string,
  fileIds: string[],
  timeSpentMinutes: number,
  rating?: number,
): Promise<TalentChallengeSubmission> {
  const db = await getDb();
  const [updated] = await db
    .update(talentChallengeSubmissions)
    .set({
      submission,
      fileIds,
      timeSpentMinutes,
      rating,
      status: "submitted",
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(talentChallengeSubmissions.id, submissionId))
    .returning();
  if (!updated) throw AppError.notFound("Submission not found");

  // Increment the challenge's completions count.
  await db
    .update(talentChallenges)
    .set({
      completionsCount: sql`${talentChallenges.completionsCount} + 1`,
      ...(rating !== undefined
        ? {
            ratingAvg:
              sql`(${talentChallenges.ratingAvg} * ${talentChallenges.ratingCount} + ${rating}) / (${talentChallenges.ratingCount} + 1)`,
            ratingCount: sql`${talentChallenges.ratingCount} + 1`,
          }
        : {}),
    })
    .where(eq(talentChallenges.id, updated.challengeId));

  return updated;
}

/* ── Talent cohorts ────────────────────────────────────────── */

export async function listAvailableCohorts(studentId: string): Promise<
  Array<{
    cohort: typeof talentCohorts.$inferSelect;
    isMember: boolean;
    memberCount: number;
  }>
> {
  const db = await getDb();
  const cohorts = await db
    .select()
    .from(talentCohorts)
    .where(eq(talentCohorts.isActive, true));

  const memberships = await db
    .select({ cohortId: talentCohortMembers.cohortId })
    .from(talentCohortMembers)
    .where(eq(talentCohortMembers.studentId, studentId));
  const memberSet = new Set(memberships.map((m) => m.cohortId));

  const counts = await db
    .select({
      cohortId: talentCohortMembers.cohortId,
      count: sql<number>`count(*)::int`,
    })
    .from(talentCohortMembers)
    .groupBy(talentCohortMembers.cohortId);
  const countMap = new Map(counts.map((c) => [c.cohortId, c.count]));

  return cohorts.map((cohort) => ({
    cohort,
    isMember: memberSet.has(cohort.id),
    memberCount: countMap.get(cohort.id) ?? 0,
  }));
}

export async function joinCohort(
  cohortId: string,
  studentId: string,
): Promise<void> {
  const db = await getDb();
  await db.insert(talentCohortMembers).values({ cohortId, studentId }).onConflictDoNothing();
}

export async function leaveCohort(
  cohortId: string,
  studentId: string,
): Promise<void> {
  const db = await getDb();
  await db
    .delete(talentCohortMembers)
    .where(
      and(
        eq(talentCohortMembers.cohortId, cohortId),
        eq(talentCohortMembers.studentId, studentId),
      ),
    );
}

/* ── Showcase items ────────────────────────────────────────── */

export async function listShowcaseItems(
  studentId: string,
): Promise<typeof talentShowcaseItems.$inferSelect[]> {
  const db = await getDb();
  return db
    .select()
    .from(talentShowcaseItems)
    .where(eq(talentShowcaseItems.studentId, studentId))
    .orderBy(desc(talentShowcaseItems.createdAt));
}

export async function createShowcaseItem(
  studentId: string,
  input: {
    title: string;
    description?: string;
    type: string;
    submissionId?: string;
    fileIds: string[];
    externalUrl?: string;
    skillId?: string;
    isPublished: boolean;
  },
): Promise<typeof talentShowcaseItems.$inferSelect> {
  const db = await getDb();
  const [created] = await db
    .insert(talentShowcaseItems)
    .values({
      studentId,
      ...input,
      publishedAt: input.isPublished ? new Date() : null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create showcase item");
  return created;
}

/* ── Floor alerts queries ──────────────────────────────────── */

export async function getActiveFloorAlerts(
  studentId: string,
): Promise<typeof floorAlerts.$inferSelect[]> {
  const db = await getDb();
  return db
    .select()
    .from(floorAlerts)
    .where(
      and(
        eq(floorAlerts.studentId, studentId),
        eq(floorAlerts.status, "active"),
      ),
    )
    .orderBy(desc(floorAlerts.createdAt));
}

/* ── Tier promotion check ─────────────────────────────────── */

/**
 * Check if the student should be promoted to the next tier on their
 * North Star. Called after each challenge submission.
 */
export async function checkTierPromotion(
  studentId: string,
): Promise<{ promoted: boolean; newTier: string | null }> {
  const db = await getDb();
  const profile = await getTalentProfile(studentId);
  if (!profile || !profile.northStarSkillId) {
    return { promoted: false, newTier: null };
  }

  // Recompute the talent score for the North Star.
  const components = await computeTalentScore(
    studentId,
    profile.northStarSkillId,
  );
  const newTier = tierForScore(components.talentScore);
  if (newTier !== profile.northStarTier) {
    await db
      .update(talentProfiles)
      .set({ northStarTier: newTier, updatedAt: new Date() })
      .where(eq(talentProfiles.id, profile.id));

    // Update the zone tier too.
    await db
      .update(studentTalentZones)
      .set({ tier: newTier, updatedAt: new Date() })
      .where(
        and(
          eq(studentTalentZones.studentId, studentId),
          eq(studentTalentZones.skillId, profile.northStarSkillId),
        ),
      );

    return { promoted: true, newTier };
  }
  return { promoted: false, newTier: null };
}
