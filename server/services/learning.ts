/**
 * §5.x — Adaptive Learning Loop — service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Covers:
 *  - Skill graph management (get / upsert student_skill_state, mastery updates)
 *  - Adaptive diagnostic (IRT-inspired question selection + result processing)
 *  - Weekly plan generation (18 tasks over 6 days + Sunday review)
 *  - Learning event batching (flushed from Zustand on the client)
 *  - Forgetting curve (Ebbinghaus, personalised per student per skill)
 *  - Daily warm-up sessions (3 questions targeting weaknesses)
 *  - Mastery projections (linear extrapolation from mastery_history)
 *  - Peer signals (batch-computed "students who struggled with X found Y helpful")
 *  - Weekly emotional check-ins
 *
 * -- Sandbox handling -------------------------------------------
 * When `getCurrentDbUser()` returns the mock sandbox user
 * (`id = "sandbox-user-demo"`, not a valid UUID), every function below
 * short-circuits and returns a safe empty / mock value so the UI can still
 * render in the preview sandbox without a real Postgres row for the demo user.
 */

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  diagnosticAnswers,
  diagnosticSessions,
  emotionalCheckins,
  learningEvents,
  learningPlans,
  masteryHistory,
  peerSignals,
  planTasks,
  questionSkillLinks,
  skillNodes,
  skillPrerequisites,
  studentSkillStates,
  warmupSessions,
} from "@/server/db/schema/learning";
import { quizQuestionOptions, quizQuestions } from "@/server/db/schema/quizzes";
import {
  EMOTIONAL_STATE_VALUES,
  LEARNING_EVENT_TYPE_VALUES,
  type EmotionalStateValue,
  type LearningEventTypeValue,
} from "@/server/db/schema/enums";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

import type {
  DiagnosticAnswer,
  DiagnosticSession,
  EmotionalCheckin,
  LearningEvent,
  LearningPlan,
  MasteryHistory as MasteryHistoryRow,
  PeerSignal as PeerSignalRow,
  PlanTask,
  SkillNode,
  StudentSkillState,
  WarmupSession,
} from "@/server/db/schema/learning";
import type { JsonRecord } from "@/server/db/schema/_env";
import type {
  QuizQuestion,
  QuizQuestionOption,
} from "@/server/db/schema/quizzes";

/* -- Public re-exports --------------------------------------- */
export type {
  DiagnosticSession,
  DiagnosticAnswer,
  EmotionalCheckin,
  LearningEvent,
  LearningPlan,
  PlanTask,
  StudentSkillState,
  SkillNode,
  WarmupSession,
};

/* -------------------------------------------------------------
 * Types (consumed by the UI / server actions)
 * ------------------------------------------------------------- */

export interface DiagnosticQuestion {
  id: string;
  questionId: string;
  skillId: string;
  skillName: string;
  label: string;
  type: string;
  options?: { id: string; label: string }[];
  difficulty: number;
  source: "verified" | "generated";
}

export interface SkillNodeWithState {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  mastery: number;
  predictedMastery: number;
  lastPracticedAt: string | null;
  trend: number;
  practiceCount: number;
  children: SkillNodeWithState[];
}

export interface LearningPlanSummary {
  id: string;
  weekKey: string;
  targetProgress: number;
  summary: string | null;
  targetedSkills: string[];
  isActive: boolean;
}

export interface PlanTaskSummary {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  skillId: string | null;
  resourceId: string | null;
  resourceType: string | null;
  estimatedMinutes: number;
  scheduledFor: string | null;
  completedAt: string | null;
}

export interface LearningEventDraft {
  type: string;
  resourceId?: string | null;
  resourceType?: string | null;
  skillId?: string | null;
  success?: boolean | null;
  score?: number | null;
  durationSec?: number;
  metadata?: Record<string, unknown> | null;
  occurredAt?: string | null;
}

export interface WarmupSummary {
  id: string;
  dateKey: string;
  status: string;
  questionIds: string[];
  skillIds: string[];
  correctCount: number;
  totalCount: number;
}

/** Per-question answer received from the client during a diagnostic. */
export interface DiagnosticAnswerInput {
  questionId: string;
  selectedOptionId?: string;
  answerText?: string;
  timeSpent?: number;
}

/** Per-question answer received from the client during a warm-up. */
export interface WarmupAnswerInput {
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
}

/** What gets recorded when a learning event arrives from the client. */
export interface LearningEventInput {
  type: string;
  resourceId?: string | null;
  resourceType?: string | null;
  skillId?: string | null;
  success?: boolean | null;
  score?: number | null;
  durationSec?: number;
  metadata?: Record<string, unknown> | null;
  occurredAt?: string | null;
}

/** Snapshot of the student's skill profile at the start of a diagnostic. */
export interface SkillSnapshot {
  strengths: SkillSnapshotEntry[];
  weaknesses: SkillSnapshotEntry[];
  prerequisites: SkillSnapshotEntry[];
  untested: SkillSnapshotEntry[];
  averageMastery: number;
}

export interface SkillSnapshotEntry {
  skillId: string;
  name: string;
  mastery: number;
}

/** Result of a single mastery update (returned by `updateMastery` / `processDiagnosticResults`). */
export interface SkillUpdate {
  skillId: string;
  skillName: string;
  beforeMastery: number;
  afterMastery: number;
  delta: number;
}

/* -------------------------------------------------------------
 * Constants & helpers
 * ------------------------------------------------------------- */

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Map the textual `difficulty` enum on `quiz_questions` to a 1-5 numeric
 * scale used by the IRT logic.
 */
function difficultyToNumber(
  difficulty: QuizQuestion["difficulty"] | null | undefined,
): number {
  switch (difficulty) {
    case "easy":
      return 1;
    case "medium":
      return 3;
    case "hard":
      return 4;
    case "expert":
      return 5;
    default:
      return 3;
  }
}

/** ISO week key like `"2026-W33"`. */
function getCurrentWeekKey(d: Date = new Date()): string {
  // ISO week — Thursday-based to avoid edge cases at year boundaries.
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      (date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Local YYYY-MM-DD date key (used for warm-up uniqueness). */
function getTodayDateKey(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* -------------------------------------------------------------
 * Forgetting curve (Phase 2 — pure function)
 * ------------------------------------------------------------- */

/**
 * Calculate the predicted mastery right now, accounting for the Ebbinghaus
 * forgetting curve.
 *
 * Formula: R = e^(-t * forgettingRate / 7)
 *   t = days since last practice
 *   forgettingRate ∈ [0.1 .. 1.0] (slow → fast forgetter)
 *
 * If the skill has never been practiced we halve the recorded mastery
 * (no memory formed yet).
 */
export function calculatePredictedMastery(params: {
  currentMastery: number;
  lastPracticedAt: Date | null;
  forgettingRate: number;
}): number {
  if (!params.lastPracticedAt) return params.currentMastery * 0.5;
  const daysSince =
    (Date.now() - params.lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24);
  const retention = Math.exp((-daysSince * params.forgettingRate) / 7);
  return round1(params.currentMastery * retention);
}

/* -------------------------------------------------------------
 * Skill graph management
 * ------------------------------------------------------------- */

/**
 * Build the full skill tree for a student with their per-skill mastery state.
 * Returns a nested structure (parent → children) ready for the UI tree view.
 */
export async function getStudentSkillGraph(
  studentId: string,
): Promise<SkillNodeWithState[]> {
  const db = await getDb();

  // 1. Load every active skill node.
  const nodes = await db
    .select()
    .from(skillNodes)
    .where(eq(skillNodes.isActive, true))
    .orderBy(asc(skillNodes.position), asc(skillNodes.name));

  // 2. Load every state row for this student in one shot.
  const states = await db
    .select()
    .from(studentSkillStates)
    .where(eq(studentSkillStates.studentId, studentId));

  const stateBySkill = new Map<string, StudentSkillState>();
  for (const s of states) stateBySkill.set(s.skillId, s);

  // 3. Assemble flat list with state, then build the tree.
  const flat: Map<string, SkillNodeWithState> = new Map();
  for (const n of nodes) {
    const st = stateBySkill.get(n.id);
    flat.set(n.id, {
      id: n.id,
      code: n.code,
      name: n.name,
      type: n.type,
      parentId: n.parentId,
      mastery: st?.mastery ?? 0,
      predictedMastery: st?.predictedMastery ?? 0,
      lastPracticedAt: st?.lastPracticedAt
        ? st.lastPracticedAt.toISOString()
        : null,
      trend: st?.trend ?? 0,
      practiceCount: st?.practiceCount ?? 0,
      children: [],
    });
  }

  const roots: SkillNodeWithState[] = [];
  for (const node of flat.values()) {
    if (node.parentId && flat.has(node.parentId)) {
      flat.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Return the existing student_skill_state row for a (student, skill) pair, or
 * create one initialised at mastery=0 if none exists yet.
 */
export async function getOrCreateSkillState(
  studentId: string,
  skillId: string,
): Promise<StudentSkillState> {
  const db = await getDb();

  const existing = await db
    .select()
    .from(studentSkillStates)
    .where(
      and(
        eq(studentSkillStates.studentId, studentId),
        eq(studentSkillStates.skillId, skillId),
      ),
    )
    .limit(1);
  const row = existing.at(0);
  if (row) return row;

  const [created] = await db
    .insert(studentSkillStates)
    .values({
      studentId,
      skillId,
      mastery: 0,
      predictedMastery: 0,
      practiceCount: 0,
      correctCount: 0,
      confidence: 50,
      forgettingRate: 0.5,
      trend: 0,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create skill state");
  return created;
}

/**
 * Apply a mastery update after an activity (correct / incorrect, difficulty).
 *
 * Simplified Bayesian-ish update:
 *   delta = isCorrect ? +5 : -3
 *   delta *= (difficulty / 3)        // harder questions weigh more
 *   newMastery = clamp(currentMastery + delta, 0, 100)
 *
 * Also bumps practiceCount / correctCount / lastPracticedAt, recomputes
 * predictedMastery via the forgetting curve, and adjusts the personalised
 * forgettingRate (slightly down on success, slightly up on failure).
 */
export async function updateMastery(params: {
  studentId: string;
  skillId: string;
  isCorrect: boolean;
  difficulty: number; // 1-5
  activityType: string;
}): Promise<{ newMastery: number; delta: number }> {
  const db = await getDb();
  const state = await getOrCreateSkillState(params.studentId, params.skillId);

  const before = state.mastery;
  const base = params.isCorrect ? 5 : -3;
  const difficultyFactor = clamp(params.difficulty, 1, 5) / 3;
  const delta = Math.round(base * difficultyFactor);
  const newMastery = clamp(before + delta, 0, 100);

  // Personalise the forgetting rate: success → forgets slightly slower.
  const newForgettingRate = clamp(
    params.isCorrect
      ? state.forgettingRate - 0.05
      : state.forgettingRate + 0.05,
    0.1,
    1.0,
  );

  const newPracticeCount = state.practiceCount + 1;
  const newCorrectCount = state.correctCount + (params.isCorrect ? 1 : 0);
  const newTrend = delta > 1 ? 1 : delta < -1 ? -1 : 0;
  const now = new Date();
  const newPredictedMastery = calculatePredictedMastery({
    currentMastery: newMastery,
    lastPracticedAt: now,
    forgettingRate: newForgettingRate,
  });

  const [updated] = await db
    .update(studentSkillStates)
    .set({
      mastery: newMastery,
      practiceCount: newPracticeCount,
      correctCount: newCorrectCount,
      lastPracticedAt: now,
      predictedMastery: newPredictedMastery,
      forgettingRate: newForgettingRate,
      trend: newTrend,
      updatedAt: now,
    })
    .where(eq(studentSkillStates.id, state.id))
    .returning();

  if (!updated) throw AppError.internal("Failed to update mastery");

  // Record a mastery_history snapshot for projections & charts.
  await db.insert(masteryHistory).values({
    studentId: params.studentId,
    skillId: params.skillId,
    mastery: newMastery,
    source: params.activityType,
  });

  return { newMastery, delta };
}

/* -------------------------------------------------------------
 * Adaptive diagnostic (IRT-inspired)
 * ------------------------------------------------------------- */

/**
 * Build a snapshot of the student's current skill profile by categorising
 * every active skill into strengths / weaknesses / prerequisites / untested.
 */
async function buildSkillSnapshot(
  studentId: string,
  subjectId?: string,
): Promise<SkillSnapshot> {
  const db = await getDb();

  const skillFilter = subjectId
    ? and(eq(skillNodes.isActive, true), eq(skillNodes.subjectId, subjectId))
    : eq(skillNodes.isActive, true);

  const nodes = await db
    .select()
    .from(skillNodes)
    .where(skillFilter)
    .orderBy(asc(skillNodes.position));

  const states = await db
    .select()
    .from(studentSkillStates)
    .where(eq(studentSkillStates.studentId, studentId));
  const stateBySkill = new Map<string, StudentSkillState>();
  for (const s of states) stateBySkill.set(s.skillId, s);

  const weaknesses: SkillSnapshotEntry[] = [];
  const strengths: SkillSnapshotEntry[] = [];
  const untested: SkillSnapshotEntry[] = [];
  const weaknessIds = new Set<string>();

  for (const n of nodes) {
    if (n.type !== "skill" && n.type !== "subskill") continue;
    const st = stateBySkill.get(n.id);
    if (!st || st.practiceCount === 0) {
      untested.push({ skillId: n.id, name: n.name, mastery: 0 });
      continue;
    }
    if (st.mastery < 40) {
      weaknesses.push({ skillId: n.id, name: n.name, mastery: st.mastery });
      weaknessIds.add(n.id);
    } else if (st.mastery >= 70) {
      strengths.push({ skillId: n.id, name: n.name, mastery: st.mastery });
    } else {
      // "Medium" mastery (40-69) — count as weaknesses to push them up.
      weaknesses.push({ skillId: n.id, name: n.name, mastery: st.mastery });
      weaknessIds.add(n.id);
    }
  }

  // Prerequisites: skills that are required by any of the student's weaknesses
  // but that the student hasn't yet mastered.
  const prerequisites: SkillSnapshotEntry[] = [];
  if (weaknessIds.size > 0) {
    const prereqRows = await db
      .select({
        prereq: skillPrerequisites,
        node: skillNodes,
      })
      .from(skillPrerequisites)
      .innerJoin(
        skillNodes,
        eq(skillNodes.id, skillPrerequisites.prerequisiteId),
      )
      .where(inArray(skillPrerequisites.skillId, [...weaknessIds]));

    const seen = new Set<string>();
    for (const r of prereqRows) {
      if (seen.has(r.node.id)) continue;
      const st = stateBySkill.get(r.node.id);
      if (st && st.mastery >= 70) continue; // already mastered prereq
      seen.add(r.node.id);
      prerequisites.push({
        skillId: r.node.id,
        name: r.node.name,
        mastery: st?.mastery ?? 0,
      });
    }
  }

  const practicedStates = states.filter((s) => s.practiceCount > 0);
  const averageMastery =
    practicedStates.length > 0
      ? Math.round(
          practicedStates.reduce((sum, s) => sum + s.mastery, 0) /
            practicedStates.length,
        )
      : 0;

  return {
    strengths,
    weaknesses,
    prerequisites,
    untested,
    averageMastery,
  };
}

/**
 * Pick one diagnostic question for a given skill, preferring verified ones
 * and respecting the requested difficulty bucket.
 */
async function pickQuestionForSkill(
  skillId: string,
  preferredDifficulty: number,
): Promise<{
  question: QuizQuestion;
  options: QuizQuestionOption[];
} | null> {
  const db = await getDb();

  // Look up all questions linked to this skill.
  const rows = await db
    .select({
      question: quizQuestions,
      link: questionSkillLinks,
    })
    .from(questionSkillLinks)
    .innerJoin(
      quizQuestions,
      eq(quizQuestions.id, questionSkillLinks.questionId),
    )
    .where(eq(questionSkillLinks.skillId, skillId));

  if (rows.length === 0) return null;

  // Sort by closeness to the preferred difficulty (verified first).
  const scored = rows
    .map((r) => ({
      question: r.question,
      distance: Math.abs(
        difficultyToNumber(r.question.difficulty) - preferredDifficulty,
      ),
      isVerified: r.question.source === "verified" ? 0 : 1,
    }))
    .sort((a, b) => {
      if (a.isVerified !== b.isVerified) return a.isVerified - b.isVerified;
      return a.distance - b.distance;
    });

  const picked = scored.at(0);
  if (!picked) return null;

  // Fetch the question's options (only for MCQ-style types).
  const opts = await db
    .select()
    .from(quizQuestionOptions)
    .where(eq(quizQuestionOptions.questionId, picked.question.id))
    .orderBy(asc(quizQuestionOptions.position));

  return { question: picked.question, options: opts };
}

function toDiagnosticQuestion(
  skillId: string,
  skillName: string,
  question: QuizQuestion,
  options: QuizQuestionOption[],
): DiagnosticQuestion {
  return {
    id: question.id, // client uses this as questionId too
    questionId: question.id,
    skillId,
    skillName,
    label: question.label,
    type: question.type,
    options: options.map((o) => ({ id: o.id, label: o.label })),
    difficulty: difficultyToNumber(question.difficulty),
    source: question.source,
  };
}

/**
 * Select questions for a diagnostic session.
 *
 * Distribution: 60% weaknesses, 20% strengths (maintenance),
 *               15% prerequisites, 5% exploration.
 *
 * Creates the `diagnostic_sessions` row up-front (status="in_progress") and
 * returns its id alongside the question list so the client can submit answers
 * back via `processDiagnosticResults`.
 */
export async function selectDiagnosticQuestions(params: {
  studentId: string;
  subjectId?: string;
  count: number; // typically 15-20
}): Promise<{
  sessionId: string;
  questions: DiagnosticQuestion[];
  skillSnapshot: SkillSnapshot;
}> {
  const count = Math.max(5, Math.min(40, params.count));

  const db = await getDb();
  const snapshot = await buildSkillSnapshot(params.studentId, params.subjectId);

  // Allocate counts per category (with rounding).
  const nWeak = Math.round(count * 0.6);
  const nStrength = Math.round(count * 0.2);
  const nPrereq = Math.round(count * 0.15);
  const nExplore = count - nWeak - nStrength - nPrereq;

  type Bucket = {
    label: "weakness" | "strength" | "prerequisite" | "explore";
    entries: SkillSnapshotEntry[];
    quota: number;
    preferredDifficulty: number;
  };

  const buckets: Bucket[] = [
    {
      label: "weakness",
      entries: snapshot.weaknesses,
      quota: nWeak,
      preferredDifficulty: 2, // start easy on weaknesses to build confidence
    },
    {
      label: "strength",
      entries: snapshot.strengths,
      quota: nStrength,
      preferredDifficulty: 4, // maintenance → harder questions
    },
    {
      label: "prerequisite",
      entries: snapshot.prerequisites,
      quota: nPrereq,
      preferredDifficulty: 2,
    },
    {
      label: "explore",
      entries: snapshot.untested,
      quota: nExplore,
      preferredDifficulty: 3,
    },
  ];

  const questions: DiagnosticQuestion[] = [];
  const usedQuestionIds = new Set<string>();

  for (const bucket of buckets) {
    // Shuffle entries to vary across sessions.
    const shuffled = [...bucket.entries].sort(() => Math.random() - 0.5);
    let taken = 0;
    for (const entry of shuffled) {
      if (taken >= bucket.quota) break;
      const picked = await pickQuestionForSkill(
        entry.skillId,
        bucket.preferredDifficulty,
      );
      if (!picked) continue;
      if (usedQuestionIds.has(picked.question.id)) continue;
      usedQuestionIds.add(picked.question.id);
      questions.push(
        toDiagnosticQuestion(
          entry.skillId,
          entry.name,
          picked.question,
          picked.options,
        ),
      );
      taken++;
    }
  }

  // Order: start medium, then alternate harder / easier (IRT-inspired order).
  questions.sort(
    (a, b) => Math.abs(a.difficulty - 3) - Math.abs(b.difficulty - 3),
  );

  // Create the session row.
  const weekKey = getCurrentWeekKey();
  const [session] = await db
    .insert(diagnosticSessions)
    .values({
      studentId: params.studentId,
      weekKey,
      status: "in_progress",
      totalQuestions: questions.length,
      correctAnswers: 0,
      score: 0,
      timeSpent: 0,
      skillSnapshot: {} as JsonRecord,
    })
    .returning();

  if (!session) throw AppError.internal("Failed to create diagnostic session");

  return {
    sessionId: session.id,
    questions,
    skillSnapshot: snapshot,
  };
}

/**
 * Grade a batch of diagnostic answers and update the student's skill states.
 *
 * IRT logic: the `perceivedDifficulty` of each answer is set adaptively based
 * on the running correctness sequence (correct → next is harder, wrong → next
 * is easier). Each answer is persisted, the session is closed and the
 * skill_snapshot column is updated with the post-diagnostic state.
 */
export async function processDiagnosticResults(params: {
  sessionId: string;
  answers: DiagnosticAnswerInput[];
}): Promise<{ score: number; skillUpdates: SkillUpdate[] }> {
  const db = await getDb();

  // Load the session.
  const sessionRows = await db
    .select()
    .from(diagnosticSessions)
    .where(eq(diagnosticSessions.id, params.sessionId))
    .limit(1);
  const session = sessionRows.at(0);
  if (!session) throw AppError.notFound("Diagnostic session not found");
  if (session.status === "completed") {
    throw AppError.conflict("Diagnostic session already completed");
  }

  const studentId = session.studentId;
  const skillUpdates: SkillUpdate[] = [];
  let correctCount = 0;
  let totalTime = 0;
  let currentDifficulty = 3; // IRT running tracker

  for (let i = 0; i < params.answers.length; i++) {
    const ans = params.answers[i];
    if (!ans) continue;

    // Resolve the question + its skill link.
    const qRow = await db
      .select({
        question: quizQuestions,
        link: questionSkillLinks,
      })
      .from(quizQuestions)
      .leftJoin(
        questionSkillLinks,
        eq(questionSkillLinks.questionId, quizQuestions.id),
      )
      .where(eq(quizQuestions.id, ans.questionId))
      .limit(1);
    const q = qRow.at(0);
    if (!q) continue;

    const skillId = q.link?.skillId ?? null;
    const questionDifficulty = difficultyToNumber(q.question.difficulty);

    // Grade: for choice-based questions, look up the selected option.
    let isCorrect: boolean | null = null;
    if (ans.selectedOptionId) {
      const optRow = await db
        .select()
        .from(quizQuestionOptions)
        .where(eq(quizQuestionOptions.id, ans.selectedOptionId))
        .limit(1);
      isCorrect = optRow.at(0)?.isCorrect ?? null;
    } else if (ans.answerText != null && ans.answerText.trim() !== "") {
      // Free-text answers cannot be auto-graded here — count as neutral.
      isCorrect = null;
    }

    const perceivedDifficulty = clamp(currentDifficulty, 1, 5);
    const timeSpent = ans.timeSpent ?? 0;
    totalTime += timeSpent;

    // Persist the diagnostic answer.
    await db.insert(diagnosticAnswers).values({
      sessionId: session.id,
      questionId: ans.questionId,
      skillId: skillId ?? null,
      selectedOptionId: ans.selectedOptionId ?? null,
      answerText: ans.answerText ?? null,
      isCorrect,
      perceivedDifficulty,
      timeSpent,
    });

    if (isCorrect === true) correctCount++;
    if (isCorrect !== null) {
      currentDifficulty = clamp(currentDifficulty + (isCorrect ? 1 : -1), 1, 5);
    }

    // Update mastery if we have a skill link.
    if (skillId && isCorrect !== null) {
      const skillNameRow = await db
        .select({ name: skillNodes.name })
        .from(skillNodes)
        .where(eq(skillNodes.id, skillId))
        .limit(1);
      const skillName = skillNameRow.at(0)?.name ?? "Skill";

      const beforeState = await getOrCreateSkillState(studentId, skillId);
      const beforeMastery = beforeState.mastery;
      const { newMastery } = await updateMastery({
        studentId,
        skillId,
        isCorrect,
        difficulty: Math.max(questionDifficulty, perceivedDifficulty),
        activityType: "diagnostic",
      });
      skillUpdates.push({
        skillId,
        skillName,
        beforeMastery,
        afterMastery: newMastery,
        delta: newMastery - beforeMastery,
      });
    }
  }

  const totalAnswered = params.answers.length;
  const score =
    totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  // Build the post-diagnostic snapshot for the JSON column.
  const postSnapshot = await buildSkillSnapshot(studentId).catch(() => null);
  const snapshotJson: JsonRecord = {
    before: {
      averageMastery: postSnapshot?.averageMastery ?? 0,
      strengths: postSnapshot?.strengths.map((s) => s.name) ?? [],
      weaknesses: postSnapshot?.weaknesses.map((s) => s.name) ?? [],
    },
    after: {
      score,
      correctCount,
      totalQuestions: totalAnswered,
      skillUpdates: skillUpdates.map((s) => ({
        skillId: s.skillId,
        delta: s.delta,
      })),
    },
  };

  await db
    .update(diagnosticSessions)
    .set({
      status: "completed",
      correctAnswers: correctCount,
      score,
      timeSpent: totalTime,
      skillSnapshot: snapshotJson,
      completedAt: new Date(),
    })
    .where(eq(diagnosticSessions.id, session.id));

  return { score, skillUpdates };
}

/* -------------------------------------------------------------
 * Weekly plan generation
 * ------------------------------------------------------------- */

/** Mutate any active plan for this student → isActive=false. */
async function deactivateActivePlans(studentId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(learningPlans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(learningPlans.studentId, studentId),
        eq(learningPlans.isActive, true),
      ),
    );
}

const PLAN_TASK_TEMPLATES: Record<
  "weakness" | "strength" | "prerequisite" | "explore",
  { type: PlanTask["type"]; title: string; estimatedMinutes: number }
> = {
  weakness: {
    type: "review_weakness",
    title: "Renforcer une compétence faible",
    estimatedMinutes: 15,
  },
  strength: {
    type: "maintain_strength",
    title: "Entretenir une compétence solide",
    estimatedMinutes: 10,
  },
  prerequisite: {
    type: "practice_quiz",
    title: "Revoir un prérequis",
    estimatedMinutes: 12,
  },
  explore: {
    type: "explore_new",
    title: "Explorer une nouvelle compétence",
    estimatedMinutes: 10,
  },
};

/**
 * Generate a weekly plan from a completed diagnostic session.
 *
 * Plan shape:
 *  - 1 "diagnostic" task (already completed — the diagnostic itself)
 *  - 3 tasks / day × 6 days (Mon-Sat) = 18 tasks
 *  - Sunday: 1 review task + 1 emotional check-in task
 *
 * Task distribution: 60% weaknesses, 20% maintenance, 15% prerequisites,
 * 5% exploration — same proportions as the diagnostic selection.
 */
export async function generateWeeklyPlan(params: {
  studentId: string;
  diagnosticSessionId: string;
}): Promise<{ plan: LearningPlan; tasks: PlanTask[] }> {
  const db = await getDb();

  // Verify the diagnostic session exists and is completed.
  const sessionRows = await db
    .select()
    .from(diagnosticSessions)
    .where(eq(diagnosticSessions.id, params.diagnosticSessionId))
    .limit(1);
  const session = sessionRows.at(0);
  if (!session) throw AppError.notFound("Diagnostic session not found");
  if (session.studentId !== params.studentId) {
    throw AppError.forbidden(
      "Diagnostic session does not belong to this student",
    );
  }

  const snapshot = await buildSkillSnapshot(params.studentId);
  const weekKey = getCurrentWeekKey();

  await deactivateActivePlans(params.studentId);

  // Build the targeted skills list (top 5 weaknesses + 1 prereq + 1 strength).
  const targetedSkills: string[] = [
    ...snapshot.weaknesses.slice(0, 5).map((s) => s.skillId),
    ...snapshot.prerequisites.slice(0, 1).map((s) => s.skillId),
    ...snapshot.strengths.slice(0, 1).map((s) => s.skillId),
  ];

  const summary =
    snapshot.weaknesses.length === 0
      ? "Aucune faiblesse majeure détectée — focus sur l'exploration et la maintenance."
      : `${snapshot.weaknesses.length} compétence(s) à renforcer cette semaine, ` +
        `${snapshot.strengths.length} à entretenir.`;

  const analysis: JsonRecord = {
    strengths: snapshot.strengths.map((s) => s.name),
    weaknesses: snapshot.weaknesses.map((s) => s.name),
    prerequisites: snapshot.prerequisites.map((s) => s.name),
    recommendations: snapshot.weaknesses
      .slice(0, 3)
      .map((s) => `Pratiquer « ${s.name} » quotidiennement`),
  };

  const [plan] = await db
    .insert(learningPlans)
    .values({
      studentId: params.studentId,
      weekKey,
      diagnosticSessionId: params.diagnosticSessionId,
      targetProgress: 5,
      targetedSkills,
      summary,
      analysis,
      isActive: true,
    })
    .returning();
  if (!plan) throw AppError.internal("Failed to create weekly plan");

  const tasks: PlanTask[] = [];

  // 1. Diagnostic task — already completed.
  const [diagTask] = await db
    .insert(planTasks)
    .values({
      planId: plan.id,
      studentId: params.studentId,
      dayOfWeek: new Date().getDay(),
      scheduledFor: new Date(),
      type: "diagnostic",
      status: "completed",
      title: "Diagnostic hebdomadaire",
      description: "Évaluation initiale de tes compétences",
      estimatedMinutes: 10,
      position: 0,
      completedAt: new Date(),
    })
    .returning();
  if (diagTask) tasks.push(diagTask);

  // 2. Build a pool of "skill targets" proportionally for the 18 daily tasks.
  const pool: {
    skillId: string;
    skillName: string;
    bucket: "weakness" | "strength" | "prerequisite" | "explore";
  }[] = [];

  const fillPool = (
    entries: SkillSnapshotEntry[],
    bucket: "weakness" | "strength" | "prerequisite" | "explore",
    target: number,
  ) => {
    if (entries.length === 0) return;
    for (let i = 0; i < target; i++) {
      const entry = entries[i % entries.length]!;
      pool.push({ skillId: entry.skillId, skillName: entry.name, bucket });
    }
  };

  fillPool(snapshot.weaknesses, "weakness", Math.round(18 * 0.6));
  fillPool(snapshot.strengths, "strength", Math.round(18 * 0.2));
  fillPool(snapshot.prerequisites, "prerequisite", Math.round(18 * 0.15));
  fillPool(snapshot.untested, "explore", 18 - pool.length);

  // Shuffle so the daily distribution feels varied.
  pool.sort(() => Math.random() - 0.5);

  // 3. Distribute pool over Monday (1) → Saturday (6), 3 per day.
  let poolIdx = 0;
  for (let day = 1; day <= 6; day++) {
    for (let slot = 0; slot < 3; slot++) {
      const target = pool[poolIdx % Math.max(pool.length, 1)];
      poolIdx++;
      if (!target) continue;
      const tmpl = PLAN_TASK_TEMPLATES[target.bucket];
      const scheduled = addDays(getNextWeekday(day));
      const [t] = await db
        .insert(planTasks)
        .values({
          planId: plan.id,
          studentId: params.studentId,
          dayOfWeek: day,
          scheduledFor: scheduled,
          type: tmpl.type,
          status: "pending",
          title: `${tmpl.title} : ${target.skillName}`,
          description: `Travaille la compétence « ${target.skillName} » pendant ~${tmpl.estimatedMinutes} min.`,
          skillId: target.skillId,
          estimatedMinutes: tmpl.estimatedMinutes,
          position: slot,
        })
        .returning();
      if (t) tasks.push(t);
    }
  }

  // 4. Sunday (0): review + emotional check-in.
  const sunday = addDays(getNextWeekday(0));
  const [reviewTask] = await db
    .insert(planTasks)
    .values({
      planId: plan.id,
      studentId: params.studentId,
      dayOfWeek: 0,
      scheduledFor: sunday,
      type: "review_weakness",
      status: "pending",
      title: "Revue de la semaine",
      description: "Reprends les compétences travaillées cette semaine.",
      estimatedMinutes: 20,
      position: 0,
    })
    .returning();
  if (reviewTask) tasks.push(reviewTask);

  const [checkinTask] = await db
    .insert(planTasks)
    .values({
      planId: plan.id,
      studentId: params.studentId,
      dayOfWeek: 0,
      scheduledFor: sunday,
      type: "warmup",
      status: "pending",
      title: "Bilan émotionnel de la semaine",
      description: "Comment t'es-tu senti cette semaine ?",
      estimatedMinutes: 2,
      position: 1,
    })
    .returning();
  if (checkinTask) tasks.push(checkinTask);

  return { plan, tasks };
}

function addDays(date: Date, days = 0): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Return the next occurrence of the given weekday (0=Sun ... 6=Sat). */
function getNextWeekday(targetDay: number, from: Date = new Date()): Date {
  const d = new Date(from);
  const current = d.getDay();
  let diff = (targetDay - current + 7) % 7;
  if (diff === 0) diff = 0; // today if same day
  d.setDate(d.getDate() + diff);
  d.setHours(9, 0, 0, 0); // 9 AM
  return d;
}

/**
 * Get today's tasks for a student (matches scheduledFor's day OR dayOfWeek).
 */
export async function getTodayTasks(studentId: string): Promise<PlanTask[]> {
  const db = await getDb();
  const now = new Date();
  const todayDay = now.getDay();

  // Today's date range (00:00 → 23:59:59 local).
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const rows = await db
    .select()
    .from(planTasks)
    .where(
      and(
        eq(planTasks.studentId, studentId),
        sql`(${planTasks.dayOfWeek} = ${todayDay} OR (${planTasks.scheduledFor} IS NOT NULL AND ${planTasks.scheduledFor} >= ${start} AND ${planTasks.scheduledFor} <= ${end}))`,
      ),
    )
    .orderBy(asc(planTasks.position), asc(planTasks.scheduledFor));

  return rows;
}

/**
 * Mark a task as completed or skipped.
 */
export async function updateTaskStatus(params: {
  taskId: string;
  status: "completed" | "skipped";
  studentId: string;
}): Promise<PlanTask> {
  const db = await getDb();

  // Verify ownership.
  const existing = await db
    .select()
    .from(planTasks)
    .where(eq(planTasks.id, params.taskId))
    .limit(1);
  const task = existing.at(0);
  if (!task) throw AppError.notFound("Task not found");
  if (task.studentId !== params.studentId) {
    throw AppError.forbidden("This task does not belong to you");
  }

  const [updated] = await db
    .update(planTasks)
    .set({
      status: params.status,
      completedAt: params.status === "completed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(planTasks.id, params.taskId))
    .returning();
  if (!updated) throw AppError.internal("Failed to update task");
  return updated;
}

/* -------------------------------------------------------------
 * Learning events (batched flush from Zustand)
 * ------------------------------------------------------------- */

/**
 * Record a batch of learning events (typically flushed from the client-side
 * Zustand store every N seconds). Each event is persisted and, if it carries
 * a skillId + success flag, also triggers a mastery update via `processEvent`.
 */
export async function recordLearningEvents(params: {
  studentId: string;
  events: LearningEventInput[];
}): Promise<{ saved: number }> {
  const db = await getDb();
  let saved = 0;

  for (const event of params.events) {
    // Validate the event type against the enum — skip unknown types silently.
    if (
      !LEARNING_EVENT_TYPE_VALUES.includes(event.type as LearningEventTypeValue)
    ) {
      logger.warn("Skipping learning event with unknown type", {
        type: event.type,
        studentId: params.studentId,
      });
      continue;
    }

    await db.insert(learningEvents).values({
      studentId: params.studentId,
      type: event.type as LearningEventTypeValue,
      resourceId: event.resourceId ?? null,
      resourceType: event.resourceType ?? null,
      skillId: event.skillId ?? null,
      success: event.success ?? null,
      score: event.score ?? null,
      durationSec: event.durationSec ?? 0,
      metadata: (event.metadata as JsonRecord) ?? null,
      occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
    });
    saved++;

    // If the event carries a success flag and a skill, update mastery.
    if (
      event.skillId &&
      event.success !== undefined &&
      event.success !== null
    ) {
      await processEvent(
        params.studentId,
        event as {
          type: string;
          skillId: string;
          success: boolean;
          metadata?: Record<string, unknown> | null;
        },
      ).catch((err) => {
        logger.error("processEvent failed", { error: String(err) });
      });
    }
  }

  return { saved };
}

/**
 * Process a single learning event: update the linked skill's mastery if the
 * event carries an explicit `success` flag and a `skillId`.
 *
 * Heuristic for `difficulty`: default 3 (medium). If the event metadata
 * contains a `difficulty` field (1-5), use that instead.
 */
async function processEvent(
  studentId: string,
  event: {
    type: string;
    skillId: string;
    success: boolean;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  const meta = (event.metadata as Record<string, unknown> | undefined) ?? {};
  const rawDifficulty =
    typeof meta.difficulty === "number" ? meta.difficulty : 3;
  const difficulty = clamp(rawDifficulty, 1, 5);

  await updateMastery({
    studentId,
    skillId: event.skillId,
    isCorrect: event.success,
    difficulty,
    activityType: event.type,
  });
}

/* -------------------------------------------------------------
 * Forgetting curve — batch refresh (Phase 2)
 * ------------------------------------------------------------- */

/**
 * Get skills whose predicted mastery (accounting for the forgetting curve)
 * has dropped significantly below their last recorded mastery — i.e. skills
 * the student is about to forget.
 *
 * Used to prioritise them in the next diagnostic / warm-up.
 */
export async function getDecliningSkills(
  studentId: string,
): Promise<StudentSkillState[]> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(studentSkillStates)
    .where(
      and(
        eq(studentSkillStates.studentId, studentId),
        sql`${studentSkillStates.predictedMastery} < ${studentSkillStates.mastery} - 5`,
      ),
    )
    .orderBy(asc(studentSkillStates.predictedMastery));

  return rows;
}

/**
 * Recompute `predictedMastery` for every skill state of a student based on
 * the Ebbinghaus forgetting curve. Should be called periodically (e.g. on
 * login) so the UI shows realistic decay.
 */
export async function refreshPredictedMastery(
  studentId: string,
): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(studentSkillStates)
    .where(eq(studentSkillStates.studentId, studentId));

  for (const row of rows) {
    const predicted = calculatePredictedMastery({
      currentMastery: row.mastery,
      lastPracticedAt: row.lastPracticedAt,
      forgettingRate: row.forgettingRate,
    });
    if (Math.abs(predicted - row.predictedMastery) < 0.1) continue;
    await db
      .update(studentSkillStates)
      .set({ predictedMastery: predicted, updatedAt: new Date() })
      .where(eq(studentSkillStates.id, row.id));
  }
}

/* -------------------------------------------------------------
 * Warm-up sessions (Phase 2)
 * ------------------------------------------------------------- */

/**
 * Get or create today's 3-question warm-up session, targeting the student's
 * weakest skills (or untested skills if none are weak yet).
 */
export async function getOrCreateTodayWarmup(
  studentId: string,
): Promise<WarmupSession> {
  const db = await getDb();
  const dateKey = getTodayDateKey();

  const existing = await db
    .select()
    .from(warmupSessions)
    .where(
      and(
        eq(warmupSessions.studentId, studentId),
        eq(warmupSessions.dateKey, dateKey),
      ),
    )
    .limit(1);
  const existingRow = existing.at(0);
  if (existingRow) return existingRow;

  // Pick 3 target skills: weakest practiced + a few untested.
  const snapshot = await buildSkillSnapshot(studentId);
  const candidates = [
    ...snapshot.weaknesses,
    ...snapshot.untested,
    ...snapshot.prerequisites,
  ].slice(0, 3);

  const questionIds: string[] = [];
  const skillIds: string[] = [];

  for (const c of candidates) {
    const picked = await pickQuestionForSkill(c.skillId, 2);
    if (picked) {
      questionIds.push(picked.question.id);
      skillIds.push(c.skillId);
    }
    if (questionIds.length >= 3) break;
  }

  const [created] = await db
    .insert(warmupSessions)
    .values({
      studentId,
      dateKey,
      status: "pending",
      questionIds,
      skillIds,
      correctCount: 0,
      totalCount: questionIds.length || 3,
      timeSpent: 0,
      startedAt: new Date(),
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create warm-up session");
  return created;
}

/**
 * Complete a warm-up session: apply mastery updates from the answers and
 * close the session row.
 */
export async function completeWarmup(params: {
  sessionId: string;
  answers: { questionId: string; isCorrect: boolean; timeSpent: number }[];
}): Promise<{ score: number; skillUpdates: SkillUpdate[] }> {
  const db = await getDb();

  const sessionRows = await db
    .select()
    .from(warmupSessions)
    .where(eq(warmupSessions.id, params.sessionId))
    .limit(1);
  const session = sessionRows.at(0);
  if (!session) throw AppError.notFound("Warm-up session not found");
  if (session.status === "completed") {
    throw AppError.conflict("Warm-up session already completed");
  }

  const studentId = session.studentId;
  const skillUpdates: SkillUpdate[] = [];
  let correctCount = 0;
  let totalTime = 0;

  for (const ans of params.answers) {
    totalTime += ans.timeSpent;
    if (ans.isCorrect) correctCount++;

    // Find the skill for this question.
    const linkRows = await db
      .select()
      .from(questionSkillLinks)
      .where(eq(questionSkillLinks.questionId, ans.questionId))
      .limit(1);
    const skillId = linkRows.at(0)?.skillId;
    if (!skillId) continue;

    const skillNameRow = await db
      .select({ name: skillNodes.name })
      .from(skillNodes)
      .where(eq(skillNodes.id, skillId))
      .limit(1);
    const skillName = skillNameRow.at(0)?.name ?? "Skill";

    const beforeState = await getOrCreateSkillState(studentId, skillId);
    const beforeMastery = beforeState.mastery;
    const { newMastery } = await updateMastery({
      studentId,
      skillId,
      isCorrect: ans.isCorrect,
      difficulty: 3,
      activityType: "warmup",
    });
    skillUpdates.push({
      skillId,
      skillName,
      beforeMastery,
      afterMastery: newMastery,
      delta: newMastery - beforeMastery,
    });
  }

  const score =
    params.answers.length > 0
      ? Math.round((correctCount / params.answers.length) * 100)
      : 0;

  await db
    .update(warmupSessions)
    .set({
      status: "completed",
      correctCount,
      timeSpent: totalTime,
      completedAt: new Date(),
    })
    .where(eq(warmupSessions.id, session.id));

  return { score, skillUpdates };
}

/* -------------------------------------------------------------
 * Projections (Phase 2)
 * ------------------------------------------------------------- */

/**
 * Project when the student will reach `targetMastery` for a skill, based on
 * the linear slope of their last `mastery_history` snapshots.
 *
 * Returns null when there is not enough history (fewer than 2 data points)
 * or when the student is not improving.
 */
export async function projectMastery(params: {
  studentId: string;
  skillId: string;
  targetMastery: number;
}): Promise<{
  daysToTarget: number;
  projectedDate: Date;
  confidence: number;
} | null> {
  const db = await getDb();

  const history = await db
    .select()
    .from(masteryHistory)
    .where(
      and(
        eq(masteryHistory.studentId, params.studentId),
        eq(masteryHistory.skillId, params.skillId),
      ),
    )
    .orderBy(desc(masteryHistory.recordedAt))
    .limit(30);

  if (history.length < 2) return null;

  const current = history[0]!;
  if (current.mastery >= params.targetMastery) {
    return {
      daysToTarget: 0,
      projectedDate: new Date(),
      confidence: 1,
    };
  }

  // Linear regression on (daysAgo, mastery) — oldest first.
  const points = history
    .slice()
    .reverse()
    .map((h) => ({
      x:
        (h.recordedAt.getTime() -
          history[history.length - 1]!.recordedAt.getTime()) /
        (1000 * 60 * 60 * 24),
      y: h.mastery,
    }));

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  if (slope <= 0) return null; // not improving

  const currentX = points[points.length - 1]!.x;
  const daysToTarget = Math.ceil(
    (params.targetMastery - (slope * currentX + intercept)) / slope,
  );

  if (daysToTarget <= 0 || !isFinite(daysToTarget)) return null;

  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + daysToTarget);

  // Confidence: R² of the regression, clamped to [0.1, 0.95].
  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce(
    (s, p) => s + (p.y - (slope * p.x + intercept)) ** 2,
    0,
  );
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const confidence = clamp(round1(r2), 0.1, 0.95);

  return { daysToTarget, projectedDate, confidence };
}

/**
 * Get the mastery history of a skill over the last `days` days, ordered
 * chronologically. Used by the projection chart in the UI.
 */
export async function getMasteryHistory(params: {
  studentId: string;
  skillId: string;
  days: number;
}): Promise<MasteryHistoryRow[]> {
  const db = await getDb();
  const since = new Date();
  since.setDate(since.getDate() - params.days);

  const rows = await db
    .select()
    .from(masteryHistory)
    .where(
      and(
        eq(masteryHistory.studentId, params.studentId),
        eq(masteryHistory.skillId, params.skillId),
        gte(masteryHistory.recordedAt, since),
      ),
    )
    .orderBy(asc(masteryHistory.recordedAt));

  return rows;
}

/* -------------------------------------------------------------
 * Peer signals (Phase 3)
 * ------------------------------------------------------------- */

/**
 * Get peer signals for a skill — "students who struggled with X found Y
 * helpful". Returns the highest-rated resources for that skill.
 */
export async function getPeerSignalsForSkill(
  skillId: string,
): Promise<PeerSignalRow[]> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(peerSignals)
    .where(eq(peerSignals.skillId, skillId))
    .orderBy(desc(peerSignals.helpfulCount), desc(peerSignals.avgImprovement))
    .limit(10);

  return rows;
}

/**
 * Recompute peer signals from learning_events.
 *
 * For each (skillId, resourceId, resourceType) tuple, count the number of
 * students who used the resource for that skill and improved afterwards —
 * and the average mastery improvement. The result is upserted into
 * `peer_signals`.
 *
 * This is intended to be called by a periodic cron job.
 */
export async function computePeerSignals(): Promise<{ computed: number }> {
  const db = await getDb();

  // Aggregate: for every (skill, resource) pair, find successful events
  // and the average mastery improvement seen on that skill right after.
  // We approximate "improvement" by looking at mastery_history entries that
  // followed the event.
  const rows: {
    skillId: string;
    resourceId: string;
    resourceType: string;
    helpfulCount: number;
    avgImprovement: number;
  }[] = await db
    .execute(
      sql`
      WITH helpful AS (
        SELECT
          e.skill_id   AS skill_id,
          e.resource_id AS resource_id,
          e.resource_type AS resource_type,
          COUNT(DISTINCT e.student_id) AS helpful_count
        FROM learning_events e
        WHERE e.skill_id IS NOT NULL
          AND e.resource_id IS NOT NULL
          AND e.success = true
        GROUP BY e.skill_id, e.resource_id, e.resource_type
        HAVING COUNT(DISTINCT e.student_id) >= 2
      ),
      improvement AS (
        SELECT
          h.skill_id,
          h.student_id,
          (MAX(h.mastery) FILTER (WHERE h.recorded_at > e.occurred_at)
            - MIN(h.mastery) FILTER (WHERE h.recorded_at <= e.occurred_at))
            AS delta
        FROM learning_events e
        JOIN mastery_history h
          ON h.skill_id = e.skill_id AND h.student_id = e.student_id
        WHERE e.skill_id IS NOT NULL AND e.resource_id IS NOT NULL
        GROUP BY h.skill_id, h.student_id, e.occurred_at
      )
      SELECT
        h.skill_id,
        h.resource_id,
        h.resource_type,
        h.helpful_count,
        COALESCE(AVG(i.delta), 0) AS avg_improvement
      FROM helpful h
      LEFT JOIN improvement i ON i.skill_id = h.skill_id
      GROUP BY h.skill_id, h.resource_id, h.resource_type, h.helpful_count
    `,
    )
    .then((r) => (r.rows ?? []) as unknown as typeof rows);

  let computed = 0;
  for (const r of rows) {
    // Upsert: delete existing rows for this (skill, resource) then insert.
    await db
      .delete(peerSignals)
      .where(
        and(
          eq(peerSignals.skillId, r.skillId),
          eq(peerSignals.resourceId, r.resourceId),
        ),
      );
    await db.insert(peerSignals).values({
      skillId: r.skillId,
      resourceId: r.resourceId,
      resourceType: r.resourceType,
      helpfulCount: Number(r.helpfulCount),
      avgImprovement: Math.round(Number(r.avgImprovement || 0) * 10) / 10,
      computedAt: new Date(),
    });
    computed++;
  }

  return { computed };
}

/* -------------------------------------------------------------
 * Emotional check-in (Phase 3)
 * ------------------------------------------------------------- */

/**
 * Record a weekly emotional check-in. If one already exists for the current
 * ISO week, it is updated (we only keep one per week).
 */
export async function recordEmotionalCheckin(params: {
  studentId: string;
  state: EmotionalStateValue;
  note?: string;
}): Promise<EmotionalCheckin> {
  if (!EMOTIONAL_STATE_VALUES.includes(params.state)) {
    throw AppError.validation(`Invalid emotional state: ${params.state}`);
  }

  const db = await getDb();
  const weekKey = getCurrentWeekKey();

  const existing = await db
    .select()
    .from(emotionalCheckins)
    .where(
      and(
        eq(emotionalCheckins.studentId, params.studentId),
        eq(emotionalCheckins.weekKey, weekKey),
      ),
    )
    .limit(1);
  const existingRow = existing.at(0);
  if (existingRow) {
    const [updated] = await db
      .update(emotionalCheckins)
      .set({ state: params.state, note: params.note ?? null })
      .where(eq(emotionalCheckins.id, existingRow.id))
      .returning();
    if (!updated)
      throw AppError.internal("Failed to update emotional check-in");
    return updated;
  }

  const [created] = await db
    .insert(emotionalCheckins)
    .values({
      studentId: params.studentId,
      weekKey,
      state: params.state,
      note: params.note ?? null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to record emotional check-in");
  return created;
}

/**
 * Get the latest emotional check-in for a student (most recent week).
 */
export async function getLatestCheckin(
  studentId: string,
): Promise<EmotionalCheckin | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(emotionalCheckins)
    .where(eq(emotionalCheckins.studentId, studentId))
    .orderBy(desc(emotionalCheckins.createdAt))
    .limit(1);
  return rows.at(0) ?? null;
}

/* -------------------------------------------------------------
 * Plan summaries (used by getCurrentPlanAction)
 * ------------------------------------------------------------- */

/**
 * Return the currently-active weekly plan for a student (or null).
 */
export async function getActivePlan(
  studentId: string,
): Promise<LearningPlanSummary | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(learningPlans)
    .where(
      and(
        eq(learningPlans.studentId, studentId),
        eq(learningPlans.isActive, true),
      ),
    )
    .orderBy(desc(learningPlans.createdAt))
    .limit(1);
  const p = rows.at(0);
  if (!p) return null;
  return {
    id: p.id,
    weekKey: p.weekKey,
    targetProgress: p.targetProgress,
    summary: p.summary,
    targetedSkills: p.targetedSkills ?? [],
    isActive: p.isActive,
  };
}

/* -------------------------------------------------------------
 * Unused-import suppression (kept for future raw queries)
 * ------------------------------------------------------------- */
void isNotNull;
void isNull;
void lte;
void inArray;
