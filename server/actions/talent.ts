"use server";

/**
 * §10.4 — Talent system server actions.
 *
 * Wraps the talent services with auth + RBAC + Zod validation.
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  startTdaSchema,
  submitTdaAnswerSchema,
  advanceTdaPhaseSchema,
  completeTdaSchema,
  chooseNorthStarSchema,
  updateTalentProfileConsentSchema,
  createTalentChallengeSchema,
  updateTalentChallengeSchema,
  listTalentChallengesSchema,
  startChallengeSchema,
  submitChallengeSchema,
  reviewChallengeSubmissionSchema,
  generateWeeklyTalentTrackSchema,
  pauseTalentTrackSchema,
  resumeTalentTrackSchema,
  respondMentorRecommendationSchema,
  bookmarkCareerSchema,
  createShowcaseItemSchema,
  updateShowcaseItemSchema,
  startSocraticConversationSchema,
  sendSocraticMessageSchema,
  joinTalentCohortSchema,
  leaveTalentCohortSchema,
  resolveFloorAlertSchema,
  type StartTdaInput,
  type SubmitTdaAnswerInput,
  type AdvanceTdaPhaseInput,
  type CompleteTdaInput,
  type ChooseNorthStarInput,
  type UpdateTalentProfileConsentInput,
  type CreateTalentChallengeInput,
  type UpdateTalentChallengeInput,
  type ListTalentChallengesInput,
  type StartChallengeInput,
  type SubmitChallengeInput,
  type ReviewChallengeSubmissionInput,
  type GenerateWeeklyTalentTrackInput,
  type PauseTalentTrackInput,
  type ResumeTalentTrackInput,
  type RespondMentorRecommendationInput,
  type BookmarkCareerInput,
  type CreateShowcaseItemInput,
  type UpdateShowcaseItemInput,
  type StartSocraticConversationInput,
  type SendSocraticMessageInput,
  type JoinTalentCohortInput,
  type LeaveTalentCohortInput,
  type ResolveFloorAlertInput,
} from "@/server/validators/talent";
import * as talentService from "@/server/services/talent";
import * as mentorService from "@/server/services/talent-mentor";
import * as careerService from "@/server/services/talent-career";
import * as socraticService from "@/server/services/talent-socratic";
import { resolveFloorAlerts as resolveAlerts } from "@/server/services/foundation-monitor";
import type { TalentProfile, TalentChallenge, TalentChallengeSubmission, TalentTrack } from "@/server/db/schema/talent";

/* ── TDA ────────────────────────────────────────────────── */

export async function startTdaAction(): Promise<
  ApiResponse<{ sessionId: string }>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    if (dbUser.role !== "student") {
      throw AppError.unauthorized("Only students can take the TDA");
    }
    const tdaSession = await talentService.startTdaSession(dbUser.id);
    logger.info("TDA session started", {
      sessionId: tdaSession.id,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });
    return { success: true, data: { sessionId: tdaSession.id } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("startTdaAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not start TDA" },
    };
  }
}

export async function submitTdaAnswerAction(
  input: SubmitTdaAnswerInput,
): Promise<ApiResponse<{ answerId: string }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = submitTdaAnswerSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const answer = await talentService.submitTdaAnswer({
      ...parsed.data,
      studentId: dbUser.id,
    });
    logger.info("TDA answer submitted", {
      sessionId: parsed.data.sessionId,
      answerId: answer.id,
      clerkId: session.clerkId,
    });
    return { success: true, data: { answerId: answer.id } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("submitTdaAnswerAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not submit answer" },
    };
  }
}

export async function advanceTdaPhaseAction(
  input: AdvanceTdaPhaseInput,
): Promise<ApiResponse<{ nextPhase: string }>> {
  try {
    await requireSession();
    const parsed = advanceTdaPhaseSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const updated = await talentService.advanceTdaPhase(
      parsed.data.sessionId,
      parsed.data.completedPhase,
      parsed.data.phaseData,
    );
    return { success: true, data: { nextPhase: updated.currentPhase } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("advanceTdaPhaseAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not advance phase" },
    };
  }
}

export async function completeTdaAction(
  input: CompleteTdaInput,
): Promise<ApiResponse<TalentProfile>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = completeTdaSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const profile = await talentService.completeTdaSession(
      parsed.data.sessionId,
      parsed.data.finalPhaseData,
    );
    logger.info("TDA completed", {
      sessionId: parsed.data.sessionId,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent");
    return { success: true, data: profile };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("completeTdaAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not complete TDA" },
    };
  }
}

/* ── Talent profile ────────────────────────────────────── */

export async function getTalentProfileAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof talentService.getTalentProfile>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const profile = await talentService.getTalentProfile(dbUser.id);
    return { success: true, data: profile };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getTalentProfileAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load profile" },
    };
  }
}

export async function chooseNorthStarAction(
  input: ChooseNorthStarInput,
): Promise<ApiResponse<{ ok: true }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = chooseNorthStarSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    await talentService.chooseNorthStar(dbUser.id, parsed.data.skillId);
    logger.info("North Star chosen", {
      studentId: dbUser.id,
      skillId: parsed.data.skillId,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent");
    return { success: true, data: { ok: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("chooseNorthStarAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not choose North Star" },
    };
  }
}

export async function updateTalentProfileConsentAction(
  input: UpdateTalentProfileConsentInput,
): Promise<ApiResponse<{ ok: true }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = updateTalentProfileConsentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    // Update the profile directly via a raw update.
    const { getDb } = await import("@/server/db");
    const { talentProfiles } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    await db
      .update(talentProfiles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(talentProfiles.studentId, dbUser.id));
    revalidatePath("/student/talent");
    return { success: true, data: { ok: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("updateTalentProfileConsentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update consent" },
    };
  }
}

/* ── Talent challenges ──────────────────────────────────── */

export async function listTalentChallengesAction(
  input: ListTalentChallengesInput,
): Promise<ApiResponse<{ items: Awaited<ReturnType<typeof talentService.listTalentChallenges>>["items"]; total: number }>> {
  try {
    await requireSession();
    const parsed = listTalentChallengesSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const result = await talentService.listTalentChallenges({
      ...parsed.data,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return { success: true, data: { items: result.items, total: result.total } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listTalentChallengesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list challenges" },
    };
  }
}

export async function getTalentChallengeAction(
  id: string,
): Promise<ApiResponse<Awaited<ReturnType<typeof talentService.getTalentChallenge>>>> {
  try {
    await requireSession();
    const challenge = await talentService.getTalentChallenge(id);
    return { success: true, data: challenge };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getTalentChallengeAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load challenge" },
    };
  }
}

export async function createTalentChallengeAction(
  input: CreateTalentChallengeInput,
): Promise<ApiResponse<TalentChallenge>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    if (
      dbUser.role !== "platform_admin" &&
      dbUser.role !== "teacher" &&
      dbUser.role !== "content_moderator"
    ) {
      throw AppError.unauthorized(
        "Only teachers, admins and moderators can create challenges",
      );
    }
    const parsed = createTalentChallengeSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const challenge = await talentService.createTalentChallenge(
      {
        skillId: parsed.data.skillId,
        subjectId: parsed.data.subjectId,
        title: parsed.data.title,
        description: parsed.data.description,
        difficulty: parsed.data.difficulty,
        estimatedMinutes: parsed.data.estimatedMinutes,
        type: parsed.data.type,
        requiredTier: parsed.data.requiredTier,
        payload: parsed.data.payload,
        solutionHint: parsed.data.solutionHint,
        tags: parsed.data.tags,
      },
      dbUser.id,
    );
    logger.info("Talent challenge created", {
      challengeId: challenge.id,
      skillId: parsed.data.skillId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent/challenges");
    revalidatePath("/teacher/talent-challenges");
    return { success: true, data: challenge };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("createTalentChallengeAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create challenge" },
    };
  }
}

export async function publishTalentChallengeAction(
  id: string,
): Promise<ApiResponse<{ ok: true }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    if (
      dbUser.role !== "platform_admin" &&
      dbUser.role !== "content_moderator"
    ) {
      throw AppError.unauthorized("Only admins can publish challenges");
    }
    const { getDb } = await import("@/server/db");
    const { talentChallenges } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    await db
      .update(talentChallenges)
      .set({ isPublished: true, updatedAt: new Date() })
      .where(eq(talentChallenges.id, id));
    revalidatePath("/admin/talent");
    return { success: true, data: { ok: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("publishTalentChallengeAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not publish challenge" },
    };
  }
}

/* ── Challenge submissions ──────────────────────────────── */

export async function startChallengeAction(
  input: StartChallengeInput,
): Promise<ApiResponse<TalentChallengeSubmission>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = startChallengeSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const submission = await talentService.startChallenge(
      parsed.data.challengeId,
      dbUser.id,
    );
    logger.info("Challenge started", {
      submissionId: submission.id,
      challengeId: parsed.data.challengeId,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });
    return { success: true, data: submission };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("startChallengeAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not start challenge" },
    };
  }
}

export async function submitChallengeAction(
  input: SubmitChallengeInput,
): Promise<ApiResponse<TalentChallengeSubmission>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = submitChallengeSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const submission = await talentService.submitChallenge(
      parsed.data.submissionId,
      parsed.data.submission,
      parsed.data.fileIds,
      parsed.data.timeSpentMinutes,
      parsed.data.rating,
    );
    logger.info("Challenge submitted", {
      submissionId: submission.id,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });

    // Trigger tier promotion check.
    try {
      await talentService.checkTierPromotion(dbUser.id);
    } catch (e) {
      logger.warn("Tier promotion check failed (non-blocking)", {
        error: String(e),
      });
    }

    revalidatePath("/student/talent");
    revalidatePath(`/student/talent/challenges/${submission.challengeId}`);
    return { success: true, data: submission };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("submitChallengeAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not submit challenge" },
    };
  }
}

/* ── Talent track ───────────────────────────────────────── */

export async function generateWeeklyTalentTrackAction(
  input: GenerateWeeklyTalentTrackInput,
): Promise<ApiResponse<TalentTrack | null>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = generateWeeklyTalentTrackSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const track = await talentService.generateWeeklyTalentTrack(
      dbUser.id,
      parsed.data.force,
    );
    logger.info("Weekly talent track generated", {
      trackId: track?.id,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent");
    return { success: true, data: track };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("generateWeeklyTalentTrackAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not generate track" },
    };
  }
}

export async function getCurrentTalentTrackAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof talentService.getCurrentTalentTrack>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const track = await talentService.getCurrentTalentTrack(dbUser.id);
    return { success: true, data: track };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getCurrentTalentTrackAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load track" },
    };
  }
}

/* ── Mentor recommendations ─────────────────────────────── */

export async function generateMentorRecommendationsAction(): Promise<
  ApiResponse<{ count: number }>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const recos = await mentorService.generateMentorRecommendations(dbUser.id);
    logger.info("Mentor recommendations generated", {
      count: recos.length,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent/mentor");
    return { success: true, data: { count: recos.length } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("generateMentorRecommendationsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not generate recommendations" },
    };
  }
}

export async function listMentorRecommendationsAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof mentorService.listMentorRecommendations>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const recos = await mentorService.listMentorRecommendations(dbUser.id);
    return { success: true, data: recos };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listMentorRecommendationsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load recommendations" },
    };
  }
}

export async function respondMentorRecommendationAction(
  input: RespondMentorRecommendationInput,
): Promise<ApiResponse<{ ok: true }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = respondMentorRecommendationSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    await mentorService.respondToRecommendation(
      parsed.data.recommendationId,
      dbUser.id,
      parsed.data.status,
    );
    logger.info("Mentor recommendation responded", {
      recoId: parsed.data.recommendationId,
      status: parsed.data.status,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent/mentor");
    return { success: true, data: { ok: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("respondMentorRecommendationAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not respond" },
    };
  }
}

/* ── Career matching ─────────────────────────────────────── */

export async function matchCareersAction(): Promise<
  ApiResponse<{ count: number }>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const matches = await careerService.matchCareersForStudent(dbUser.id);
    logger.info("Career matches generated", {
      count: matches.length,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent/career");
    return { success: true, data: { count: matches.length } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("matchCareersAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not match careers" },
    };
  }
}

export async function listCareerMatchesAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof careerService.listCareerMatches>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const matches = await careerService.listCareerMatches(dbUser.id);
    return { success: true, data: matches };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listCareerMatchesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load matches" },
    };
  }
}

export async function bookmarkCareerAction(
  input: BookmarkCareerInput,
): Promise<ApiResponse<{ ok: true }>> {
  try {
    await requireSession();
    const parsed = bookmarkCareerSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    await careerService.bookmarkCareer(
      parsed.data.careerMatchId,
      parsed.data.isBookmarked,
    );
    revalidatePath("/student/talent/career");
    return { success: true, data: { ok: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("bookmarkCareerAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not bookmark" },
    };
  }
}

/* ── Socratic conversations ─────────────────────────────── */

export async function startSocraticConversationAction(
  input: StartSocraticConversationInput,
): Promise<ApiResponse<{ conversationId: string }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = startSocraticConversationSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const conv = await socraticService.startConversation(
      dbUser.id,
      parsed.data.skillId,
      parsed.data.challengeId,
      parsed.data.title,
    );
    logger.info("Socratic conversation started", {
      conversationId: conv.id,
      clerkId: session.clerkId,
    });
    return { success: true, data: { conversationId: conv.id } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("startSocraticConversationAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not start conversation" },
    };
  }
}

export async function sendSocraticMessageAction(
  input: SendSocraticMessageInput,
): Promise<ApiResponse<{ response: string }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = sendSocraticMessageSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const response = await socraticService.generateSocraticResponse(
      dbUser.id,
      parsed.data.conversationId,
      parsed.data.message,
    );
    logger.info("Socratic message sent", {
      conversationId: parsed.data.conversationId,
      clerkId: session.clerkId,
    });
    return { success: true, data: { response } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("sendSocraticMessageAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not send message" },
    };
  }
}

export async function listSocraticConversationsAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof socraticService.listConversations>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const convs = await socraticService.listConversations(dbUser.id);
    return { success: true, data: convs };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listSocraticConversationsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list conversations" },
    };
  }
}

export async function getSocraticConversationAction(
  conversationId: string,
): Promise<
  ApiResponse<Awaited<ReturnType<typeof socraticService.getConversation>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const conv = await socraticService.getConversation(conversationId, dbUser.id);
    return { success: true, data: conv };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getSocraticConversationAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load conversation" },
    };
  }
}

/* ── Cohorts ─────────────────────────────────────────────── */

export async function listAvailableCohortsAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof talentService.listAvailableCohorts>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const cohorts = await talentService.listAvailableCohorts(dbUser.id);
    return { success: true, data: cohorts };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listAvailableCohortsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list cohorts" },
    };
  }
}

export async function joinCohortAction(
  input: JoinTalentCohortInput,
): Promise<ApiResponse<{ ok: true }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = joinTalentCohortSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    await talentService.joinCohort(parsed.data.cohortId, dbUser.id);
    logger.info("Joined cohort", {
      cohortId: parsed.data.cohortId,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent/cohorts");
    return { success: true, data: { ok: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("joinCohortAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not join cohort" },
    };
  }
}

export async function leaveCohortAction(
  input: LeaveTalentCohortInput,
): Promise<ApiResponse<{ ok: true }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = leaveTalentCohortSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    await talentService.leaveCohort(parsed.data.cohortId, dbUser.id);
    revalidatePath("/student/talent/cohorts");
    return { success: true, data: { ok: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("leaveCohortAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not leave cohort" },
    };
  }
}

/* ── Showcase items ─────────────────────────────────────── */

export async function listShowcaseItemsAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof talentService.listShowcaseItems>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const items = await talentService.listShowcaseItems(dbUser.id);
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listShowcaseItemsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load showcase" },
    };
  }
}

export async function createShowcaseItemAction(
  input: CreateShowcaseItemInput,
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const parsed = createShowcaseItemSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const item = await talentService.createShowcaseItem(dbUser.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      submissionId: parsed.data.submissionId,
      fileIds: parsed.data.fileIds,
      externalUrl: parsed.data.externalUrl,
      skillId: parsed.data.skillId,
      isPublished: parsed.data.isPublished,
    });
    logger.info("Showcase item created", {
      itemId: item.id,
      studentId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/student/talent/showcase");
    return { success: true, data: { id: item.id } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("createShowcaseItemAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create showcase item" },
    };
  }
}

/* ── Floor alerts ────────────────────────────────────────── */

export async function getActiveFloorAlertsAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof talentService.getActiveFloorAlerts>>>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const alerts = await talentService.getActiveFloorAlerts(dbUser.id);
    return { success: true, data: alerts };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getActiveFloorAlertsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load floor alerts" },
    };
  }
}

export async function resolveFloorAlertAction(
  input: ResolveFloorAlertInput,
): Promise<ApiResponse<{ resolved: number }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const resolved = await resolveAlerts(dbUser.id);
    revalidatePath("/student/talent");
    return { success: true, data: { resolved } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("resolveFloorAlertAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not resolve alerts" },
    };
  }
}
