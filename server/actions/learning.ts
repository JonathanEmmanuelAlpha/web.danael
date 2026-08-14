"use server";

/**
 * §5.x — Adaptive Learning Loop — server actions.
 *
 * Wraps the learning service with auth + Zod validation. Each action returns a
 * typed `ApiResponse<T>` and revalidates Next.js caches on mutations.
 *
 * Auth model:
 *  - Every action calls `requireSession()` + `getCurrentDbUser()`.
 *  - The acting student is the current DB user (`dbUser.id`).
 *    with id `"sandbox-user-demo"`. The service detects this and short-circuits
 *    DB access — every action still succeeds with mock / empty data so the UI
 *    can render in the preview sandbox.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

import {
  EMOTIONAL_STATE_VALUES,
  type EmotionalStateValue,
} from "@/server/db/schema/enums";
import * as learningService from "@/server/services/learning";
import type {
  DiagnosticQuestion,
  LearningPlanSummary,
  PlanTaskSummary,
  SkillNodeWithState,
  WarmupSummary,
} from "@/server/services/learning";
import type {
  EmotionalCheckin,
  MasteryHistory,
  PeerSignal,
  PlanTask,
} from "@/server/db/schema/learning";

/* ─────────────────────────────────────────────────────────────
 * Zod schemas
 * ───────────────────────────────────────────────────────────── */

const startDiagnosticSchema = z.object({
  subjectId: z.uuid().optional(),
  count: z.coerce.number().int().min(5).max(40).optional(),
});

const submitDiagnosticSchema = z.object({
  sessionId: z.uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        selectedOptionId: z.uuid().optional(),
        answerText: z.string().max(2000).optional(),
        timeSpent: z.number().int().min(0).optional(),
      }),
    )
    .min(1, "At least one answer is required"),
});

const updateTaskStatusSchema = z.object({
  taskId: z.uuid(),
  status: z.enum(["completed", "skipped"]),
});

const getMasteryHistorySchema = z.object({
  skillId: z.uuid(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const completeWarmupSchema = z.object({
  sessionId: z.uuid(),
  answers: z.array(
    z.object({
      questionId: z.uuid(),
      isCorrect: z.boolean(),
      timeSpent: z.number().int().min(0),
    }),
  ),
});

const projectMasterySchema = z.object({
  skillId: z.uuid(),
  targetMastery: z.coerce.number().int().min(1).max(100).default(80),
});

const recordEmotionalCheckinSchema = z.object({
  state: z.enum(EMOTIONAL_STATE_VALUES),
  note: z.string().max(500).optional(),
});

const getPeerSignalsSchema = z.object({
  skillId: z.uuid(),
});

const recordLearningEventsSchema = z.array(
  z.object({
    type: z.string().min(1).max(80),
    resourceId: z.uuid().optional(),
    resourceType: z.string().max(80).optional(),
    skillId: z.uuid().optional(),
    success: z.boolean().optional(),
    score: z.number().min(0).max(100).optional(),
    durationSec: z.number().int().min(0).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    occurredAt: z.iso.datetime().optional(),
  }),
);

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

/** Convert a DB PlanTask row to a JSON-safe summary for the client. */
function toTaskSummary(t: PlanTask): PlanTaskSummary {
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    title: t.title,
    description: t.description,
    skillId: t.skillId,
    resourceId: t.resourceId,
    resourceType: t.resourceType,
    estimatedMinutes: t.estimatedMinutes,
    scheduledFor: t.scheduledFor ? t.scheduledFor.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  };
}

function handleError(
  err: unknown,
  label: string,
  fallback: string,
): ApiResponse<never> {
  if (err instanceof AppError) {
    return { success: false, error: { code: err.code, message: err.message } };
  }
  logger.error(`${label} failed`, { error: String(err) });
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: fallback },
  };
}

/* ─────────────────────────────────────────────────────────────
 * Diagnostic
 * ───────────────────────────────────────────────────────────── */

/**
 * Start a diagnostic session: select IRT-distributed questions and create the
 * session row (status="in_progress").
 */
export async function startDiagnosticAction(input: {
  subjectId?: string;
  count?: number;
}): Promise<
  ApiResponse<{ sessionId: string; questions: DiagnosticQuestion[] }>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = startDiagnosticSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const result = await learningService.selectDiagnosticQuestions({
      studentId: dbUser.id,
      subjectId: parsed.data.subjectId,
      count: parsed.data.count ?? 15,
    });

    logger.info("Diagnostic started", {
      studentId: dbUser.id,
      sessionId: result.sessionId,
      questionsCount: result.questions.length,
    });

    return { success: true, data: result };
  } catch (err) {
    return handleError(
      err,
      "startDiagnosticAction",
      "Could not start diagnostic",
    );
  }
}

/**
 * Submit a diagnostic: grade answers, update skill mastery, generate the
 * weekly plan, return the score and new plan id.
 */
export async function submitDiagnosticAction(input: {
  sessionId: string;
  answers: {
    questionId: string;
    selectedOptionId?: string;
    answerText?: string;
    timeSpent?: number;
  }[];
}): Promise<ApiResponse<{ score: number; planId: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = submitDiagnosticSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Grade the answers and update mastery.
    const { score } = await learningService.processDiagnosticResults({
      sessionId: parsed.data.sessionId,
      answers: parsed.data.answers,
    });

    // Generate the weekly plan from this diagnostic session.
    let planId: string | null = null;
    try {
      const { plan } = await learningService.generateWeeklyPlan({
        studentId: dbUser.id,
        diagnosticSessionId: parsed.data.sessionId,
      });
      planId = plan.id;
    } catch (planErr) {
      // Plan generation is best-effort — if it fails (e.g. sandbox mode),
      // we still want to return the diagnostic score.
      logger.warn("Weekly plan generation failed", {
        error: String(planErr),
        sessionId: parsed.data.sessionId,
      });
    }

    if (!planId) {
      throw AppError.internal("Failed to generate weekly plan");
    }

    logger.info("Diagnostic submitted", {
      studentId: dbUser.id,
      sessionId: parsed.data.sessionId,
      score,
      planId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/learning");
    return { success: true, data: { score, planId } };
  } catch (err) {
    return handleError(
      err,
      "submitDiagnosticAction",
      "Could not submit diagnostic",
    );
  }
}

/* ─────────────────────────────────────────────────────────────
 * Plan
 * ───────────────────────────────────────────────────────────── */

/** Get the currently-active weekly plan for the logged-in student. */
export async function getCurrentPlanAction(): Promise<
  ApiResponse<LearningPlanSummary | null>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const plan = await learningService.getActivePlan(dbUser.id);
    return { success: true, data: plan };
  } catch (err) {
    return handleError(
      err,
      "getCurrentPlanAction",
      "Could not load weekly plan",
    );
  }
}

/** Get today's tasks for the logged-in student. */
export async function getTodayTasksAction(): Promise<
  ApiResponse<PlanTaskSummary[]>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const tasks = await learningService.getTodayTasks(dbUser.id);
    return { success: true, data: tasks.map(toTaskSummary) };
  } catch (err) {
    return handleError(
      err,
      "getTodayTasksAction",
      "Could not load today's tasks",
    );
  }
}

/** Mark a task as completed or skipped. */
export async function updateTaskStatusAction(input: {
  taskId: string;
  status: "completed" | "skipped";
}): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = updateTaskStatusSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const updated = await learningService.updateTaskStatus({
      taskId: parsed.data.taskId,
      status: parsed.data.status,
      studentId: dbUser.id,
    });

    logger.info("Task status updated", {
      taskId: updated.id,
      status: updated.status,
      studentId: dbUser.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/learning");
    return { success: true, data: { status: updated.status } };
  } catch (err) {
    return handleError(err, "updateTaskStatusAction", "Could not update task");
  }
}

/* ─────────────────────────────────────────────────────────────
 * Skill graph
 * ───────────────────────────────────────────────────────────── */

/** Get the full skill graph for the logged-in student (nested tree). */
export async function getSkillGraphAction(): Promise<
  ApiResponse<SkillNodeWithState[]>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const graph = await learningService.getStudentSkillGraph(dbUser.id);
    return { success: true, data: graph };
  } catch (err) {
    return handleError(
      err,
      "getSkillGraphAction",
      "Could not load skill graph",
    );
  }
}

/** Get mastery history for a skill (used by the projection chart). */
export async function getMasteryHistoryAction(input: {
  skillId: string;
  days?: number;
}): Promise<ApiResponse<MasteryHistory[]>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = getMasteryHistorySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const history = await learningService.getMasteryHistory({
      studentId: dbUser.id,
      skillId: parsed.data.skillId,
      days: parsed.data.days,
    });
    return { success: true, data: history };
  } catch (err) {
    return handleError(
      err,
      "getMasteryHistoryAction",
      "Could not load mastery history",
    );
  }
}

/* ─────────────────────────────────────────────────────────────
 * Learning events
 * ───────────────────────────────────────────────────────────── */

/** Record a batch of learning events flushed from the client Zustand store. */
export async function recordLearningEventsAction(
  events: learningService.LearningEventDraft[],
): Promise<ApiResponse<{ saved: number }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = recordLearningEventsSchema.safeParse(events);
    if (!parsed.success) {
      throw AppError.validation("Invalid events", parsed.error.flatten());
    }

    const result = await learningService.recordLearningEvents({
      studentId: dbUser.id,
      events: parsed.data,
    });

    if (result.saved > 0) {
      // Mastery may have changed → refresh cache.
      revalidatePath("/dashboard");
      revalidatePath("/learning");
    }

    return { success: true, data: result };
  } catch (err) {
    return handleError(
      err,
      "recordLearningEventsAction",
      "Could not save events",
    );
  }
}

/* ─────────────────────────────────────────────────────────────
 * Warm-up
 * ───────────────────────────────────────────────────────────── */

/** Get or create today's 3-question warm-up session. */
export async function getTodayWarmupAction(): Promise<
  ApiResponse<WarmupSummary | null>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const session = await learningService.getOrCreateTodayWarmup(dbUser.id);
    return {
      success: true,
      data: {
        id: session.id,
        dateKey: session.dateKey,
        status: session.status,
        questionIds: session.questionIds ?? [],
        skillIds: session.skillIds ?? [],
        correctCount: session.correctCount,
        totalCount: session.totalCount,
      },
    };
  } catch (err) {
    return handleError(err, "getTodayWarmupAction", "Could not load warm-up");
  }
}

/** Complete a warm-up session: apply mastery updates and close it. */
export async function completeWarmupAction(input: {
  sessionId: string;
  answers: { questionId: string; isCorrect: boolean; timeSpent: number }[];
}): Promise<ApiResponse<{ score: number }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = completeWarmupSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const { score } = await learningService.completeWarmup({
      sessionId: parsed.data.sessionId,
      answers: parsed.data.answers,
    });

    logger.info("Warm-up completed", {
      sessionId: parsed.data.sessionId,
      score,
      studentId: dbUser.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/learning");
    return { success: true, data: { score } };
  } catch (err) {
    return handleError(
      err,
      "completeWarmupAction",
      "Could not complete warm-up",
    );
  }
}

/* ─────────────────────────────────────────────────────────────
 * Projections
 * ───────────────────────────────────────────────────────────── */

/** Project when the student will reach a target mastery for a skill. */
export async function projectMasteryAction(input: {
  skillId: string;
  targetMastery?: number;
}): Promise<
  ApiResponse<{
    daysToTarget: number;
    projectedDate: string;
    confidence: number;
  } | null>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = projectMasterySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const projection = await learningService.projectMastery({
      studentId: dbUser.id,
      skillId: parsed.data.skillId,
      targetMastery: parsed.data.targetMastery,
    });

    if (!projection) return { success: true, data: null };

    return {
      success: true,
      data: {
        daysToTarget: projection.daysToTarget,
        projectedDate: projection.projectedDate.toISOString(),
        confidence: projection.confidence,
      },
    };
  } catch (err) {
    return handleError(
      err,
      "projectMasteryAction",
      "Could not project mastery",
    );
  }
}

/* ─────────────────────────────────────────────────────────────
 * Emotional check-in
 * ───────────────────────────────────────────────────────────── */

/** Record a weekly emotional check-in (one per ISO week, upserted). */
export async function recordEmotionalCheckinAction(input: {
  state: EmotionalStateValue;
  note?: string;
}): Promise<ApiResponse<{ id: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = recordEmotionalCheckinSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const checkin = await learningService.recordEmotionalCheckin({
      studentId: dbUser.id,
      state: parsed.data.state,
      note: parsed.data.note,
    });

    logger.info("Emotional check-in recorded", {
      studentId: dbUser.id,
      state: checkin.state,
      weekKey: checkin.weekKey,
    });

    revalidatePath("/dashboard");
    revalidatePath("/learning");
    return { success: true, data: { id: checkin.id } };
  } catch (err) {
    return handleError(
      err,
      "recordEmotionalCheckinAction",
      "Could not record check-in",
    );
  }
}

/** Get the latest emotional check-in for the logged-in student. */
export async function getLatestCheckinAction(): Promise<
  ApiResponse<EmotionalCheckin | null>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const checkin = await learningService.getLatestCheckin(dbUser.id);
    return { success: true, data: checkin };
  } catch (err) {
    return handleError(
      err,
      "getLatestCheckinAction",
      "Could not load latest check-in",
    );
  }
}

/* ─────────────────────────────────────────────────────────────
 * Peer signals
 * ───────────────────────────────────────────────────────────── */

/** Get peer signals for a skill ("Students who struggled with X found Y helpful"). */
export async function getPeerSignalsAction(input: {
  skillId: string;
}): Promise<ApiResponse<PeerSignal[]>> {
  try {
    await requireSession();

    const parsed = getPeerSignalsSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const signals = await learningService.getPeerSignalsForSkill(
      parsed.data.skillId,
    );
    return { success: true, data: signals };
  } catch (err) {
    return handleError(
      err,
      "getPeerSignalsAction",
      "Could not load peer signals",
    );
  }
}
