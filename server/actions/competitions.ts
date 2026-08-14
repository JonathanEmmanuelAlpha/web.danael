"use server";

/**
 * §5.7 — Competition server actions.
 *
 * Wraps the competitions service with auth + RBAC + Zod validation. Each action
 * returns a typed ApiResponse<T>.
 *
 * Authorization rules:
 *  - createCompetition, updateCompetition, deleteCompetition, publishCompetition,
 *    finalizeCompetition → teacher, school_admin, platform_admin
 *  - listCompetitions, getCompetition, getLeaderboard → any authenticated user
 *  - joinCompetition, submitScore → any authenticated user (acting on self)
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  createCompetitionSchema,
  joinCompetitionSchema,
  listCompetitionsQuerySchema,
  submitCompetitionScoreSchema,
  updateCompetitionSchema,
  type CreateCompetitionInput,
  type JoinCompetitionInput,
  type ListCompetitionsQuery,
  type SubmitCompetitionScoreInput,
  type UpdateCompetitionInput,
} from "@/server/validators/competitions";
import * as competitionsService from "@/server/services/competitions";
import type {
  Competition,
  CompetitionListItem,
  CompetitionListResult,
  CompetitionWithCounts,
  RankedParticipant,
} from "@/server/services/competitions";
import type { CompetitionParticipant } from "@/server/db/schema/competitions";

/* ── Helpers ───────────────────────────────────────────────── */

const TEACHER_ROLES = ["teacher", "school_admin", "platform_admin"] as const;
type TeacherRole = (typeof TEACHER_ROLES)[number];

function isTeacherRole(role: string | undefined): role is TeacherRole {
  return !!role && (TEACHER_ROLES as readonly string[]).includes(role);
}

async function requireTeacher(): Promise<{ userId: string; role: TeacherRole }> {
  const session = await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");
  if (!isTeacherRole(dbUser.role)) {
    throw AppError.unauthorized(
      "Only teachers and school administrators can manage competitions",
    );
  }
  return { userId: dbUser.id, role: dbUser.role };
}

/* ── Mutations: competitions ───────────────────────────────── */

export async function createCompetitionAction(
  input: CreateCompetitionInput,
): Promise<ApiResponse<Competition>> {
  try {
    const { userId, role } = await requireTeacher();
    const parsed = createCompetitionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const competition = await competitionsService.createCompetition(
      parsed.data,
      userId,
    );
    logger.info("Competition created", {
      competitionId: competition.id,
      title: competition.title,
      byUserId: userId,
      role,
    });
    revalidatePath("/teacher-competitions");
    revalidatePath("/competitions");
    return { success: true, data: competition };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("createCompetitionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create competition" },
    };
  }
}

export async function updateCompetitionAction(
  input: UpdateCompetitionInput,
): Promise<ApiResponse<Competition>> {
  try {
    const { userId } = await requireTeacher();
    const parsed = updateCompetitionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const updated = await competitionsService.updateCompetition(
      parsed.data.id,
      parsed.data,
    );
    logger.info("Competition updated", {
      competitionId: updated.id,
      byUserId: userId,
    });
    revalidatePath(`/teacher-competitions/${updated.id}`);
    revalidatePath(`/competitions/${updated.id}`);
    revalidatePath("/teacher-competitions");
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("updateCompetitionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update competition" },
    };
  }
}

export async function deleteCompetitionAction(
  id: string,
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const { userId } = await requireTeacher();
    await competitionsService.deleteCompetition(id);
    logger.info("Competition deleted", { competitionId: id, byUserId: userId });
    revalidatePath("/teacher-competitions");
    revalidatePath("/competitions");
    return { success: true, data: { deleted: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("deleteCompetitionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not delete competition" },
    };
  }
}

export async function publishCompetitionAction(
  id: string,
): Promise<ApiResponse<Competition>> {
  try {
    const { userId } = await requireTeacher();
    const updated = await competitionsService.publishCompetition(id);
    logger.info("Competition published", {
      competitionId: updated.id,
      byUserId: userId,
    });
    revalidatePath(`/teacher-competitions/${updated.id}`);
    revalidatePath(`/competitions/${updated.id}`);
    revalidatePath("/competitions");
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("publishCompetitionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not publish competition" },
    };
  }
}

export async function finalizeCompetitionAction(
  id: string,
): Promise<ApiResponse<{ competition: Competition; ranked: RankedParticipant[] }>> {
  try {
    const { userId } = await requireTeacher();
    const result = await competitionsService.finalizeCompetition(id);
    logger.info("Competition finalized", {
      competitionId: id,
      byUserId: userId,
      participants: result.ranked.length,
    });
    revalidatePath(`/teacher-competitions/${id}`);
    revalidatePath(`/competitions/${id}`);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("finalizeCompetitionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not finalize competition" },
    };
  }
}

/* ── Participants ─────────────────────────────────────────── */

export async function joinCompetitionAction(
  input: JoinCompetitionInput,
): Promise<ApiResponse<CompetitionParticipant>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    void session;

    const parsed = joinCompetitionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const participant = await competitionsService.joinCompetition(
      parsed.data.competitionId,
      dbUser.id,
      parsed.data.isAnonymous,
    );
    revalidatePath(`/competitions/${parsed.data.competitionId}`);
    revalidatePath("/competitions");
    return { success: true, data: participant };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("joinCompetitionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not join competition" },
    };
  }
}

export async function submitScoreAction(
  input: SubmitCompetitionScoreInput,
): Promise<ApiResponse<CompetitionParticipant>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = submitCompetitionScoreSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const participant = await competitionsService.submitCompetitionScore(
      parsed.data.competitionId,
      dbUser.id,
      parsed.data.score,
    );
    revalidatePath(`/competitions/${parsed.data.competitionId}`);
    return { success: true, data: participant };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("submitScoreAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not submit score" },
    };
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getCompetitionAction(
  id: string,
): Promise<ApiResponse<CompetitionWithCounts>> {
  try {
    await requireSession();
    const competition = await competitionsService.getCompetitionById(id);
    return { success: true, data: competition };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getCompetitionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch competition" },
    };
  }
}

export async function listCompetitionsAction(
  query: Partial<ListCompetitionsQuery>,
): Promise<ApiResponse<CompetitionListResult>> {
  try {
    await requireSession();
    const parsed = listCompetitionsQuerySchema.safeParse({
      page: 1,
      pageSize: 100,
      ...query,
    });
    if (!parsed.success) {
      throw AppError.validation("Invalid query", parsed.error.flatten());
    }
    const data = await competitionsService.listCompetitions(parsed.data);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listCompetitionsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list competitions" },
    };
  }
}

export async function listActiveCompetitionsAction(): Promise<
  ApiResponse<CompetitionListItem[]>
> {
  try {
    await requireSession();
    const data = await competitionsService.listActiveCompetitions();
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listActiveCompetitionsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list active competitions" },
    };
  }
}

export async function listMyCompetitionsAction(): Promise<
  ApiResponse<CompetitionListItem[]>
> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const data = await competitionsService.listUserCompetitions(dbUser.id);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listMyCompetitionsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list your competitions" },
    };
  }
}

export async function getLeaderboardAction(
  competitionId: string,
): Promise<ApiResponse<RankedParticipant[]>> {
  try {
    await requireSession();
    const data = await competitionsService.getLeaderboard(competitionId);
    return { success: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getLeaderboardAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not fetch leaderboard" },
    };
  }
}
