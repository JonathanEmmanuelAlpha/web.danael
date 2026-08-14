"use server";

/**
 * §10.4 — AI question server actions (Adaptive Learning Loop).
 *
 * Wraps the AI-questions service with auth + RBAC + Zod validation. Each action
 * returns a typed `ApiResponse<T>` and revalidates the relevant path on
 * mutation.
 *
 * Authorization rules:
 *  - generateQuestionsAction → teacher / school_admin / platform_admin
 *  - listGeneratedQuestionsAction → teacher / school_admin / platform_admin
 *  - verifyQuestionAction / bulkVerifyQuestionsAction → teacher / school_admin / platform_admin
 *  - editQuestionAction → teacher / school_admin / platform_admin
 *  - deleteQuestionAction → teacher / school_admin / platform_admin
 *  - listSkillsForFilterAction → teacher / school_admin / platform_admin
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  QUESTION_SOURCE_VALUES,
  QUIZ_QUESTION_TYPE_VALUES,
  DIFFICULTY_VALUES,
} from "@/server/db/schema/enums";
import * as aiQuestionsService from "@/server/services/ai-questions";
import type {
  GenerateQuestionsResult,
  GeneratedQuestionListItem,
  SkillOption,
} from "@/server/services/ai-questions";

/* ── Helpers ───────────────────────────────────────────────── */

const TEACHER_ROLES = ["teacher", "school_admin", "platform_admin"] as const;
type TeacherRole = (typeof TEACHER_ROLES)[number];

function isTeacherRole(role: string | undefined): role is TeacherRole {
  return !!role && (TEACHER_ROLES as readonly string[]).includes(role);
}

async function requireTeacher(): Promise<{ userId: string; role: TeacherRole }> {
  await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");
  if (!isTeacherRole(dbUser.role)) {
    throw AppError.unauthorized(
      "Only teachers and school administrators can perform this action",
    );
  }
  return { userId: dbUser.id, role: dbUser.role };
}

/* ── Schemas ───────────────────────────────────────────────── */

const generateQuestionsSchema = z.object({
  skillId: z.uuid(),
  count: z.number().int().min(1).max(20).default(5),
  difficulty: z.enum(DIFFICULTY_VALUES).default("medium"),
  questionTypes: z
    .array(z.enum(QUIZ_QUESTION_TYPE_VALUES))
    .min(1)
    .default(["single_choice"]),
});

const listGeneratedQuestionsSchema = z.object({
  subjectId: z.uuid().optional(),
  skillId: z.uuid().optional(),
  unverifiedOnly: z.boolean().optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

const verifyQuestionSchema = z.object({
  questionId: z.uuid(),
});

const editQuestionSchema = z.object({
  questionId: z.uuid(),
  label: z.string().min(2).max(2000),
  explanation: z.string().max(2000).optional(),
  options: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1).max(500),
        isCorrect: z.boolean(),
      }),
    )
    .max(10)
    .optional(),
});

const deleteQuestionSchema = z.object({
  questionId: z.uuid(),
});

const bulkVerifySchema = z.object({
  questionIds: z.array(z.uuid()).min(1).max(100),
});

const listSkillsForFilterSchema = z.object({
  subjectId: z.uuid().optional(),
});

/* ── Generate ──────────────────────────────────────────────── */

export async function generateQuestionsAction(
  input: {
    skillId: string;
    count?: number;
    difficulty?: "easy" | "medium" | "hard" | "expert";
    questionTypes?: string[];
  },
): Promise<ApiResponse<GenerateQuestionsResult>> {
  try {
    const { userId, role } = await requireTeacher();

    const parsed = generateQuestionsSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Look up the skill so we can pass name + description to the AI prompt.
    const skill = await aiQuestionsService
      .listSkillsForFilter()
      .then((skills) => skills.find((s) => s.id === parsed.data.skillId));
    if (!skill) {
      throw AppError.notFound("Skill not found", { skillId: parsed.data.skillId });
    }

    // The AI prompt expects only easy/medium/hard; coerce "expert" → "hard".
    const aiDifficulty =
      parsed.data.difficulty === "expert" ? "hard" : parsed.data.difficulty;
    const aiQuestionTypes = parsed.data.questionTypes.filter(
      (t): t is "single_choice" | "multiple_choice" | "true_false" | "short_answer" =>
        ["single_choice", "multiple_choice", "true_false", "short_answer"].includes(t),
    ) as ("single_choice" | "multiple_choice" | "true_false" | "short_answer")[];

    const result = await aiQuestionsService.generateQuestionsForSkill({
      skillId: skill.id,
      skillName: skill.name,
      skillDescription: undefined,
      count: parsed.data.count,
      difficulty: aiDifficulty,
      questionTypes: aiQuestionTypes,
      teacherId: userId,
    });

    logger.info("AI questions generated", {
      skillId: skill.id,
      generated: result.generated,
      source: result.source,
      byUserId: userId,
      role,
    });

    revalidatePath("/teacher-questions");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("generateQuestionsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not generate questions",
      },
    };
  }
}

/* ── List ──────────────────────────────────────────────────── */

export async function listGeneratedQuestionsAction(
  input?: {
    subjectId?: string;
    skillId?: string;
    unverifiedOnly?: boolean;
    page?: number;
    pageSize?: number;
    search?: string;
  },
): Promise<
  ApiResponse<{
    items: GeneratedQuestionListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    await requireTeacher();
    const parsed = listGeneratedQuestionsSchema.safeParse(input ?? {});
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await aiQuestionsService.listGeneratedQuestions(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listGeneratedQuestionsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load questions" },
    };
  }
}

/* ── Verify ────────────────────────────────────────────────── */

export async function verifyQuestionAction(input: {
  questionId: string;
}): Promise<ApiResponse<{ status: string }>> {
  try {
    const { userId } = await requireTeacher();
    const parsed = verifyQuestionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const updated = await aiQuestionsService.verifyQuestion(
      parsed.data.questionId,
      userId,
    );
    logger.info("Question verified", {
      questionId: updated.id,
      byUserId: userId,
    });
    revalidatePath("/teacher-questions");
    return { success: true, data: { status: updated.source } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("verifyQuestionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not verify question" },
    };
  }
}

/* ── Edit ──────────────────────────────────────────────────── */

export async function editQuestionAction(input: {
  questionId: string;
  label: string;
  explanation?: string;
  options?: { id?: string; label: string; isCorrect: boolean }[];
}): Promise<ApiResponse<{ id: string }>> {
  try {
    await requireTeacher();
    const parsed = editQuestionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const updated = await aiQuestionsService.editGeneratedQuestion(parsed.data);
    logger.info("Question edited", { questionId: updated.id });
    revalidatePath("/teacher-questions");
    return { success: true, data: { id: updated.id } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("editQuestionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not edit question" },
    };
  }
}

/* ── Delete ────────────────────────────────────────────────── */

export async function deleteQuestionAction(input: {
  questionId: string;
}): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    await requireTeacher();
    const parsed = deleteQuestionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    await aiQuestionsService.deleteGeneratedQuestion(parsed.data.questionId);
    logger.info("Question deleted", { questionId: parsed.data.questionId });
    revalidatePath("/teacher-questions");
    return { success: true, data: { deleted: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("deleteQuestionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not delete question" },
    };
  }
}

/* ── Bulk verify ───────────────────────────────────────────── */

export async function bulkVerifyQuestionsAction(input: {
  questionIds: string[];
}): Promise<ApiResponse<{ verified: number }>> {
  try {
    const { userId } = await requireTeacher();
    const parsed = bulkVerifySchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const verified = await aiQuestionsService.bulkVerifyQuestions(
      parsed.data.questionIds,
      userId,
    );
    logger.info("Bulk question verification", {
      requested: parsed.data.questionIds.length,
      verified,
      byUserId: userId,
    });
    revalidatePath("/teacher-questions");
    return { success: true, data: { verified } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("bulkVerifyQuestionsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not verify questions" },
    };
  }
}

/* ── Skills for filter ─────────────────────────────────────── */

export async function listSkillsForFilterAction(input?: {
  subjectId?: string;
}): Promise<ApiResponse<SkillOption[]>> {
  try {
    await requireTeacher();
    const parsed = listSkillsForFilterSchema.safeParse(input ?? {});
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const skills = await aiQuestionsService.listSkillsForFilter(parsed.data.subjectId);
    return { success: true, data: skills };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listSkillsForFilterAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load skills" },
    };
  }
}

/* ── Subject list (re-exported for the filter dropdown) ────── */
//
// We avoid a circular import here by reaching into the subjects service
// directly via a small lazy import. The subject catalog is small enough that
// we can return the full list.
export async function listSubjectsForFilterAction(): Promise<
  ApiResponse<{ id: string; name: string; code: string }[]>
> {
  try {
    await requireTeacher();
    const { listSubjects } = await import("@/server/services/subjects");
    const subjects = await listSubjects();
    return { success: true, data: subjects };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listSubjectsForFilterAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load subjects" },
    };
  }
}

/* ── Suppress unused-import warning ────────────────────────── */
void QUESTION_SOURCE_VALUES;
