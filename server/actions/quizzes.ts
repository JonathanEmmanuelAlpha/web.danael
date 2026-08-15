"use server";

/**
 * §5.6 — Quiz server actions.
 *
 * Wraps the quizzes service with auth + RBAC + Zod validation. Each action
 * returns a typed ApiResponse<T>.
 *
 * Authorization rules:
 *  - Quiz create / update / delete / publish → teacher, school_admin, platform_admin
 *  - Quiz list (own) → teacher, school_admin, platform_admin
 *  - Quiz list (available) → student (only published)
 *  - Start session → student (only published quizzes) or quiz creator
 *  - Submit answer → session owner
 *  - Complete session → session owner
 *  - Session results → session owner (student) or quiz creator (teacher)
 *  - Question bank add / list → teacher, school_admin, platform_admin
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  createQuizSchema,
  updateQuizSchema,
  addQuizQuestionSchema,
  updateQuizQuestionSchema,
  listQuizzesQuerySchema,
  startQuizSessionSchema,
  submitQuizAnswerSchema,
  completeQuizSessionSchema,
  addQuestionToBankSchema,
  listQuestionBankQuerySchema,
  type CreateQuizInput,
  type UpdateQuizInput,
  type AddQuizQuestionInput,
  type UpdateQuizQuestionInput,
  type ListQuizzesQuery,
  type StartQuizSessionInput,
  type SubmitQuizAnswerInput,
  type CompleteQuizSessionInput,
  type AddQuestionToBankInput,
  type ListQuestionBankQuery,
} from "@/server/validators/quizzes";
import * as quizzesService from "@/server/services/quizzes";
import type {
  QuizWithDetails,
  QuizListItem,
  QuizSessionWithRelations,
  QuizSessionResults,
  QuizQuestionWithOptions,
  QuestionBank,
} from "@/server/services/quizzes";

/* ── Helpers ───────────────────────────────────────────────── */

const TEACHER_ROLES = ["teacher", "school_admin", "platform_admin"] as const;
type TeacherRole = (typeof TEACHER_ROLES)[number];

function isTeacherRole(role: string | undefined): role is TeacherRole {
  return !!role && (TEACHER_ROLES as readonly string[]).includes(role);
}

async function requireTeacher(): Promise<{
  userId: string;
  role: TeacherRole;
}> {
  const session = await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");
  if (!isTeacherRole(dbUser.role)) {
    throw AppError.unauthorized(
      "Only teachers and school administrators can perform this action",
    );
  }
  return { userId: dbUser.id, role: dbUser.role };
}

/**
 * Verify the current user is the creator of a quiz (or a platform_admin).
 */
async function requireQuizEditor(
  quizId: string,
): Promise<{ userId: string; quiz: QuizWithDetails }> {
  const { userId } = await requireTeacher();
  const quiz = await quizzesService.getQuizById(quizId);
  if (quiz.createdBy !== userId) {
    const dbUser = await getCurrentDbUser();
    if (dbUser?.role !== "platform_admin") {
      throw AppError.forbidden("You can only edit quizzes you created");
    }
  }
  return { userId, quiz };
}

/* ── Mutations: quizzes ───────────────────────────────────── */

export async function createQuizAction(
  input: CreateQuizInput,
): Promise<ApiResponse<QuizWithDetails>> {
  try {
    const { userId, role } = await requireTeacher();

    const parsed = createQuizSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const quiz = await quizzesService.createQuiz(parsed.data, userId);
    logger.info("Quiz created", {
      quizId: quiz.id,
      title: quiz.title,
      byUserId: userId,
      role,
      questionsCount: quiz.questionsCount,
    });
    revalidatePath("/quizzes");
    return { success: true, data: quiz };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("createQuizAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create quiz" },
    };
  }
}

export async function updateQuizAction(
  input: UpdateQuizInput,
): Promise<ApiResponse<QuizWithDetails>> {
  try {
    const { userId } = await requireQuizEditor(input.id);

    const parsed = updateQuizSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const updated = await quizzesService.updateQuiz(
      parsed.data.id,
      parsed.data,
    );
    logger.info("Quiz updated", { quizId: updated.id, byUserId: userId });
    revalidatePath(`/quizzes/${updated.id}`);
    revalidatePath("/quizzes");
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("updateQuizAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update quiz" },
    };
  }
}

export async function deleteQuizAction(
  id: string,
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const { userId } = await requireQuizEditor(id);
    await quizzesService.deleteQuiz(id);
    logger.info("Quiz deleted", { quizId: id, byUserId: userId });
    revalidatePath("/quizzes");
    return { success: true, data: { deleted: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("deleteQuizAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not delete quiz" },
    };
  }
}

export async function publishQuizAction(
  id: string,
  publish: boolean,
): Promise<ApiResponse<QuizWithDetails>> {
  try {
    const { userId } = await requireQuizEditor(id);
    await quizzesService.publishQuiz(id, publish);
    logger.info("Quiz publish toggled", {
      quizId: id,
      publish,
      byUserId: userId,
    });
    revalidatePath(`/quizzes/${id}`);
    revalidatePath("/quizzes");
    const refreshed = await quizzesService.getQuizById(id);
    return { success: true, data: refreshed };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("publishQuizAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not publish quiz" },
    };
  }
}

/* ── Mutations: questions ─────────────────────────────────── */

export async function addQuestionAction(
  input: AddQuizQuestionInput,
): Promise<ApiResponse<QuizQuestionWithOptions>> {
  try {
    const { userId } = await requireQuizEditor(input.quizId);

    const parsed = addQuizQuestionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const question = await quizzesService.addQuestion(parsed.data);
    logger.info("Quiz question added", {
      quizId: input.quizId,
      questionId: question.id,
      byUserId: userId,
    });
    revalidatePath(`/quizzes/${input.quizId}`);
    return { success: true, data: question };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("addQuestionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not add question" },
    };
  }
}

export async function updateQuestionAction(
  questionId: string,
  input: Omit<UpdateQuizQuestionInput, "id">,
): Promise<ApiResponse<QuizQuestionWithOptions>> {
  try {
    const parsed = updateQuizQuestionSchema.safeParse({
      ...input,
      id: questionId,
    });
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    // Resolve the question's quiz to perform the editor authorization check.
    const existingQuestion = await quizzesService.getQuestion(questionId);
    if (!existingQuestion) throw AppError.notFound("Question not found");
    const { userId } = await requireQuizEditor(existingQuestion.quizId);

    // Strip validator-only fields (id, quizId) before forwarding to the service.
    const { id: _id, quizId: _quizId, ...payload } = parsed.data;
    void _id;
    void _quizId;

    const question = await quizzesService.updateQuestion(questionId, payload);
    logger.info("Quiz question updated", {
      questionId,
      quizId: existingQuestion.quizId,
      byUserId: userId,
    });
    return { success: true, data: question };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("updateQuestionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update question" },
    };
  }
}

export async function removeQuestionAction(
  questionId: string,
): Promise<ApiResponse<{ removed: boolean }>> {
  try {
    const existingQuestion = await quizzesService.getQuestion(questionId);
    if (!existingQuestion) throw AppError.notFound("Question not found");
    const { userId } = await requireQuizEditor(existingQuestion.quizId);
    await quizzesService.removeQuestion(questionId);
    logger.info("Quiz question removed", {
      questionId,
      quizId: existingQuestion.quizId,
      byUserId: userId,
    });
    revalidatePath(`/quizzes/${existingQuestion.quizId}`);
    revalidatePath("/quizzes");
    return { success: true, data: { removed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("removeQuestionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not remove question" },
    };
  }
}

/* ── Mutations: quiz session ───────────────────────────────── */

export async function startSessionAction(
  input: StartQuizSessionInput,
): Promise<ApiResponse<QuizSessionWithRelations>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // The session userId must match the authenticated user.
    if (input.userId !== dbUser.id) {
      throw AppError.forbidden("You can only start a session for yourself");
    }

    const parsed = startQuizSessionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const quizSession = await quizzesService.startSession(parsed.data);
    logger.info("Quiz session started", {
      sessionId: quizSession.id,
      quizId: parsed.data.quizId,
      userId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath(`/quizzes/${parsed.data.quizId}`);
    return { success: true, data: quizSession };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("startSessionAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not start quiz session",
      },
    };
  }
}

export async function submitAnswerAction(
  input: SubmitQuizAnswerInput,
): Promise<
  ApiResponse<{
    answerId: string;
    isCorrect: boolean | null;
    pointsAwarded: number;
  }>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = submitQuizAnswerSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Verify the session belongs to the current user.
    const existingSession = await quizzesService.getSession(
      parsed.data.sessionId,
    );
    if (!existingSession) throw AppError.notFound("Quiz session not found");
    if (existingSession.user.id !== dbUser.id) {
      throw AppError.forbidden(
        "You can only submit answers to your own sessions",
      );
    }

    const answer = await quizzesService.submitAnswer(parsed.data);
    logger.info("Quiz answer submitted", {
      answerId: answer.id,
      sessionId: parsed.data.sessionId,
      questionId: parsed.data.questionId,
      userId: dbUser.id,
      isCorrect: answer.isCorrect,
    });
    return {
      success: true,
      data: {
        answerId: answer.id,
        isCorrect: answer.isCorrect,
        pointsAwarded: answer.pointsAwarded,
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("submitAnswerAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not submit answer" },
    };
  }
}

export async function completeSessionAction(
  input: CompleteQuizSessionInput,
): Promise<ApiResponse<QuizSessionWithRelations>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = completeQuizSessionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Verify the session belongs to the current user.
    const existingSession = await quizzesService.getSession(parsed.data.id);
    if (!existingSession) throw AppError.notFound("Quiz session not found");
    if (existingSession.user.id !== dbUser.id) {
      throw AppError.forbidden("You can only complete your own sessions");
    }

    const completed = await quizzesService.completeSession(parsed.data);
    logger.info("Quiz session completed", {
      sessionId: completed.id,
      status: completed.status,
      totalScore: completed.totalScore,
      maxScore: completed.maxScore,
      timeSpent: completed.timeSpent,
      userId: dbUser.id,
    });
    revalidatePath(`/quizzes/${completed.quizId}`);
    revalidatePath("/quizzes");
    const refreshed = await quizzesService.getSession(completed.id);
    if (!refreshed)
      throw AppError.internal("Session completed but could not be reloaded");
    return { success: true, data: refreshed };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("completeSessionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not complete session" },
    };
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getQuizAction(
  id: string,
): Promise<ApiResponse<QuizWithDetails>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const quiz = await quizzesService.getQuizById(id);

    // Visibility rules:
    //  - Creator can always see (incl. draft).
    //  - Others can see only published quizzes (students, parents, etc.).
    if (!quiz.isPublished && quiz.createdBy !== dbUser.id) {
      if (!isTeacherRole(dbUser.role)) {
        throw AppError.notFound("Quiz not found");
      }
    }
    return { success: true, data: quiz };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getQuizAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load quiz" },
    };
  }
}

export async function listQuizzesAction(
  filters: ListQuizzesQuery,
): Promise<
  ApiResponse<{
    items: QuizListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    await requireSession();
    const parsed = listQuizzesQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await quizzesService.listQuizzes(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listQuizzesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list quizzes" },
    };
  }
}

export async function listForStudentAction(
  filters: ListQuizzesQuery,
): Promise<
  ApiResponse<{
    items: QuizListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = listQuizzesQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await quizzesService.listQuizzesForStudent(
      dbUser.id,
      parsed.data,
    );
    void session;
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listForStudentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list quizzes" },
    };
  }
}

export async function listForTeacherAction(
  filters: ListQuizzesQuery,
): Promise<
  ApiResponse<{
    items: QuizListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const { userId } = await requireTeacher();
    const parsed = listQuizzesQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await quizzesService.listQuizzesForTeacher(
      userId,
      parsed.data,
    );
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listForTeacherAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list quizzes" },
    };
  }
}

export async function getSessionAction(
  sessionId: string,
): Promise<ApiResponse<QuizSessionWithRelations>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const session = await quizzesService.getSession(sessionId);
    if (!session) throw AppError.notFound("Quiz session not found");

    // The session owner, the quiz creator, or a platform_admin can view.
    const isOwner = session.user.id === dbUser.id;
    const isCreator = session.quiz.createdBy === dbUser.id;
    if (!isOwner && !isCreator && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You are not allowed to view this session");
    }
    return { success: true, data: session };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getSessionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load session" },
    };
  }
}

export async function getSessionResultsAction(
  sessionId: string,
): Promise<ApiResponse<QuizSessionResults>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const session = await quizzesService.getSession(sessionId);
    if (!session) throw AppError.notFound("Quiz session not found");

    const isOwner = session.user.id === dbUser.id;
    const isCreator = session.quiz.createdBy === dbUser.id;
    if (!isOwner && !isCreator && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You are not allowed to view these results");
    }
    // Only allow viewing results on completed sessions.
    if (session.status !== "completed" && session.status !== "abandoned") {
      throw AppError.validation(
        "Results are only available for completed sessions",
      );
    }

    const results = await quizzesService.getSessionResults(sessionId);
    return { success: true, data: results };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getSessionResultsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not load session results",
      },
    };
  }
}

export async function listSessionsForQuizAction(
  quizId: string,
): Promise<ApiResponse<QuizSessionWithRelations[]>> {
  try {
    await requireQuizEditor(quizId);
    const sessions = await quizzesService.listSessionsForQuiz(quizId);
    return { success: true, data: sessions };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listSessionsForQuizAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list sessions" },
    };
  }
}

/* ── Question bank ────────────────────────────────────────── */

export async function listQuestionBankAction(
  filters: ListQuestionBankQuery,
): Promise<
  ApiResponse<{
    items: QuestionBank[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    await requireTeacher();
    const parsed = listQuestionBankQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await quizzesService.listQuestionBank(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listQuestionBankAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not list question bank",
      },
    };
  }
}

export async function addQuestionToBankAction(
  input: AddQuestionToBankInput,
): Promise<ApiResponse<QuestionBank>> {
  try {
    const { userId } = await requireTeacher();
    const parsed = addQuestionToBankSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }
    const item = await quizzesService.addQuestionToBank(parsed.data);
    logger.info("Question added to bank", {
      bankId: item.id,
      byUserId: userId,
    });
    return { success: true, data: item };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("addQuestionToBankAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not add question to bank",
      },
    };
  }
}
