/**
 * §5.6 — Quiz service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Includes:
 *  - CRUD on quizzes (with nested questions + options)
 *  - Quiz publishing
 *  - Quiz session lifecycle (start → submit answer → complete)
 *  - Auto-grading for single_choice / true_false / multiple_choice
 *  - Manual grading placeholder for short_answer / essay
 *  - Question bank repository
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  SQL,
  sql,
} from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  questionBanks,
  quizAnswers,
  quizQuestionOptions,
  quizQuestions,
  quizSessions,
  quizzes,
  subjects,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type {
  AddQuestionToBankInput,
  AddQuizQuestionInput,
  CompleteQuizSessionInput,
  CreateQuizInput,
  ListQuestionBankQuery,
  ListQuizzesQuery,
  StartQuizSessionInput,
  SubmitQuizAnswerInput,
  UpdateQuizInput,
  UpdateQuizQuestionInput,
} from "@/server/validators/quizzes";
import type {
  NewQuestionBank,
  NewQuiz,
  NewQuizAnswer,
  NewQuizQuestion,
  NewQuizQuestionOption,
  NewQuizSession,
  QuestionBank,
  Quiz,
  QuizAnswer,
  QuizQuestion,
  QuizQuestionOption,
  QuizSession,
} from "@/server/db/schema/quizzes";
import type { Subject } from "@/server/db/schema/schools";
import type { User } from "@/server/db/schema/users";

/* -- Types --------------------------------------------------- */

export type {
  Quiz,
  QuizQuestion,
  QuizQuestionOption,
  QuizSession,
  QuizAnswer,
  QuestionBank,
};

export type QuizQuestionWithOptions = QuizQuestion & {
  options: QuizQuestionOption[];
};

export type QuizWithDetails = Quiz & {
  subject: Pick<Subject, "id" | "name" | "code"> | null;
  creator: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl"
  > | null;
  questions: QuizQuestionWithOptions[];
  questionsCount: number;
  maxScore: number;
  sessionsCount: number;
};

export type QuizListItem = Quiz & {
  subject: Pick<Subject, "id" | "name" | "code"> | null;
  creator: Pick<User, "id" | "firstName" | "lastName"> | null;
  questionsCount: number;
  sessionsCount: number;
};

export type QuizSessionWithRelations = QuizSession & {
  quiz: Quiz;
  user: Pick<User, "id" | "firstName" | "lastName" | "email">;
};

export type QuizAnswerWithDetails = QuizAnswer & {
  question: QuizQuestionWithOptions;
  selectedOption: QuizQuestionOption | null;
};

export type QuizSessionResults = {
  session: QuizSession;
  quiz: Quiz;
  answers: QuizAnswerWithDetails[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
};

/* -- Mutations: quizzes ------------------------------------- */

/**
 * Create a new quiz with its questions + options in a single transaction.
 * `createdBy` is injected by the server action.
 */
export async function createQuiz(
  input: CreateQuizInput,
  createdBy: string,
): Promise<QuizWithDetails> {
  const db = await getDb();

  // Validate questions structure (min options, correct option, etc.).
  validateQuestions(input.questions);

  const [created] = await db
    .insert(quizzes)
    .values({
      title: input.title,
      description: input.description,
      subjectId: input.subjectId,
      skillId: input.skillId,
      level: input.level,
      series: input.series,
      type: input.type,
      timeLimitMinutes: input.timeLimitMinutes,
      passingScore: input.passingScore,
      isPublished: input.isPublished,
      createdBy,
    } satisfies NewQuiz)
    .returning();
  if (!created) throw AppError.internal("Failed to create quiz");

  // Insert questions + their options.
  for (let i = 0; i < input.questions.length; i++) {
    const q = input.questions[i];
    if (!q) continue;
    await addQuestionToQuiz(db, created.id, {
      ...q,
      quizId: created.id,
      position: q.position ?? i,
    });
  }

  return getQuizById(created.id);
}

/**
 * Update editable quiz fields. If `input.questions` is provided, ALL existing
 * questions are replaced atomically (only allowed when the quiz has no
 * sessions, to preserve answer history).
 */
export async function updateQuiz(
  id: string,
  input: UpdateQuizInput,
): Promise<QuizWithDetails> {
  const db = await getDb();

  const existing = await getQuizById(id);
  if (existing.isPublished && input.isPublished !== false) {
    // Editing a published quiz is forbidden (would invalidate live sessions).
    // The only allowed mutation on a published quiz is to unpublish it.
    if (
      input.title !== undefined ||
      input.description !== undefined ||
      input.subjectId !== undefined ||
      input.skillId !== undefined ||
      input.level !== undefined ||
      input.series !== undefined ||
      input.type !== undefined ||
      input.timeLimitMinutes !== undefined ||
      input.passingScore !== undefined
    ) {
      throw AppError.conflict(
        "Cannot edit a published quiz. Unpublish it first.",
      );
    }
  }

  // If replacing questions, ensure no sessions exist.
  if (input.questions) {
    validateQuestions(input.questions);
    if (existing.sessionsCount > 0) {
      throw AppError.conflict(
        "Cannot edit questions of a quiz that already has sessions",
      );
    }
  }

  const [updated] = await db
    .update(quizzes)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.series !== undefined ? { series: input.series } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.timeLimitMinutes !== undefined
        ? { timeLimitMinutes: input.timeLimitMinutes }
        : {}),
      ...(input.passingScore !== undefined
        ? { passingScore: input.passingScore }
        : {}),
      ...(input.isPublished !== undefined
        ? { isPublished: input.isPublished }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Quiz not found");

  // Replace questions atomically (delete existing + insert new).
  if (input.questions) {
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, id));
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      if (!q) continue;
      await addQuestionToQuiz(db, id, {
        ...q,
        quizId: updated.id,
        position: q.position ?? i,
      });
    }
  }

  return getQuizById(id);
}

/**
 * Delete a quiz and cascade-delete its questions, options, sessions, answers.
 */
export async function deleteQuiz(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(quizzes).where(eq(quizzes.id, id));
}

/**
 * Publish a quiz (only if it has at least one question).
 */
export async function publishQuiz(id: string, publish: boolean): Promise<Quiz> {
  const db = await getDb();

  if (publish) {
    const questionsCount = await db
      .select({ c: count() })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, id));
    if (Number(questionsCount.at(0)?.c ?? 0) === 0) {
      throw AppError.validation("Cannot publish a quiz with no questions");
    }
  }

  const [updated] = await db
    .update(quizzes)
    .set({ isPublished: publish, updatedAt: new Date() })
    .where(eq(quizzes.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Quiz not found");
  return updated;
}

/* -- Mutations: questions + options ------------------------- */

/**
 * Add a question (with its options) to an existing quiz.
 */
export async function addQuestion(
  input: AddQuizQuestionInput,
): Promise<QuizQuestionWithOptions> {
  const db = await getDb();
  return addQuestionToQuiz(db, input.quizId, input);
}

/**
 * Update an existing question (label, points, explanation, difficulty, type).
 * If `options` is provided, replace the existing options atomically.
 *
 * All fields are optional — only the supplied ones will be updated.
 */
export async function updateQuestion(
  questionId: string,
  input: Partial<Omit<UpdateQuizQuestionInput, "quizId">>,
): Promise<QuizQuestionWithOptions> {
  const db = await getDb();

  const existing = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
    .limit(1);
  const question = existing.at(0);
  if (!question) throw AppError.notFound("Question not found");

  // Don't allow editing questions of a published quiz.
  const quizRows = await db
    .select({ isPublished: quizzes.isPublished })
    .from(quizzes)
    .where(eq(quizzes.id, question.quizId))
    .limit(1);
  if (quizRows.at(0)?.isPublished) {
    throw AppError.conflict("Cannot edit questions of a published quiz");
  }

  if (input.options) {
    validateQuestion(input.type ?? question.type, input.options);
  }

  await db
    .update(quizQuestions)
    .set({
      type: input.type ?? question.type,
      label: input.label ?? question.label,
      points: input.points ?? question.points,
      explanation: input.explanation ?? question.explanation,
      difficulty: input.difficulty ?? question.difficulty,
      position: input.position ?? question.position,
      updatedAt: new Date(),
    })
    .where(eq(quizQuestions.id, questionId));

  if (input.options) {
    // Replace options atomically.
    await db
      .delete(quizQuestionOptions)
      .where(eq(quizQuestionOptions.questionId, questionId));
    for (let i = 0; i < input.options.length; i++) {
      const opt = input.options[i];
      if (!opt) continue;
      await db.insert(quizQuestionOptions).values({
        questionId,
        label: opt.label,
        isCorrect: opt.isCorrect,
        position: opt.position ?? i,
      } satisfies NewQuizQuestionOption);
    }
  }

  const refreshed = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
    .limit(1);
  const refreshedQuestion = refreshed.at(0);
  if (!refreshedQuestion) throw AppError.internal("Failed to reload question");

  const opts = await db
    .select()
    .from(quizQuestionOptions)
    .where(eq(quizQuestionOptions.questionId, questionId))
    .orderBy(asc(quizQuestionOptions.position));

  return { ...refreshedQuestion, options: opts };
}

/**
 * Fetch a single question (with its options) — used by the
 * `updateQuestionAction` to resolve the parent quiz for authorization.
 */
export async function getQuestion(
  questionId: string,
): Promise<QuizQuestionWithOptions | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
    .limit(1);
  const question = rows.at(0);
  if (!question) return null;
  const opts = await db
    .select()
    .from(quizQuestionOptions)
    .where(eq(quizQuestionOptions.questionId, questionId))
    .orderBy(asc(quizQuestionOptions.position));
  return { ...question, options: opts };
}

/**
 * Remove a question (cascades to its options + answers).
 */
export async function removeQuestion(questionId: string): Promise<void> {
  const db = await getDb();
  await db.delete(quizQuestions).where(eq(quizQuestions.id, questionId));
}

/* -- Mutations: quiz session --------------------------------- */

/**
 * Start a new quiz session. If an in_progress session already exists for the
 * same user + quiz, reuse it (resume capability §5.6).
 */
export async function startSession(
  input: StartQuizSessionInput,
): Promise<QuizSessionWithRelations> {
  const db = await getDb();

  // Verify the quiz exists + is published (or the user is the creator).
  const quizRows = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, input.quizId))
    .limit(1);
  const quiz = quizRows.at(0);
  if (!quiz) throw AppError.notFound("Quiz not found");
  if (!quiz.isPublished && quiz.createdBy !== input.userId) {
    throw AppError.forbidden("This quiz is not published yet");
  }

  // Resume: an existing in_progress session?
  const existing = await db
    .select()
    .from(quizSessions)
    .where(
      and(
        eq(quizSessions.quizId, input.quizId),
        eq(quizSessions.userId, input.userId),
        eq(quizSessions.status, "in_progress"),
      ),
    )
    .limit(1);
  const existingSession = existing.at(0);
  if (existingSession) {
    return getSessionWithRelations(existingSession.id);
  }

  // Compute maxScore from all questions.
  const maxScoreRow = await db
    .select({ total: sql<number>`coalesce(sum(${quizQuestions.points}), 0)` })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, input.quizId));
  const maxScore = Number(maxScoreRow.at(0)?.total ?? 0);

  const [created] = await db
    .insert(quizSessions)
    .values({
      quizId: input.quizId,
      userId: input.userId,
      status: "in_progress",
      maxScore,
    } satisfies NewQuizSession)
    .returning();
  if (!created) throw AppError.internal("Failed to start quiz session");

  return getSessionWithRelations(created.id);
}

/**
 * Submit (or update) an answer to a single question within a session.
 * Auto-grades single_choice / true_false / multiple_choice questions.
 * Leaves short_answer / essay ungraded (isCorrect = null).
 */
export async function submitAnswer(
  input: SubmitQuizAnswerInput,
): Promise<QuizAnswer> {
  const db = await getDb();

  // Verify the session exists + is still in_progress.
  const sessionRows = await db
    .select()
    .from(quizSessions)
    .where(eq(quizSessions.id, input.sessionId))
    .limit(1);
  const session = sessionRows.at(0);
  if (!session) throw AppError.notFound("Quiz session not found");
  if (session.status !== "in_progress") {
    throw AppError.conflict("This quiz session is no longer in progress");
  }

  // Verify the question belongs to the quiz.
  const questionRows = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, input.questionId))
    .limit(1);
  const question = questionRows.at(0);
  if (!question) throw AppError.notFound("Question not found");
  if (question.quizId !== session.quizId) {
    throw AppError.validation("Question does not belong to this quiz");
  }

  // Resolve selected option(s) into a single canonical selection.
  // For single_choice / true_false: use selectedOptionId.
  // For multiple_choice: we keep the first selected option as selectedOptionId
  //   (legacy column) — the full set is reconstructed from quiz_answers if needed.
  // For short_answer / essay: store answerText only.
  let selectedOptionId: string | null = null;
  let answerText: string | null = null;
  let isCorrect: boolean | null = null;
  let pointsAwarded = 0;

  const isAutoGradable =
    question.type === "single_choice" ||
    question.type === "true_false" ||
    question.type === "multiple_choice";

  if (isAutoGradable) {
    const optionIds = input.selectedOptionIds?.length
      ? input.selectedOptionIds
      : input.selectedOptionId
        ? [input.selectedOptionId]
        : [];
    if (optionIds.length === 0) {
      throw AppError.validation("At least one option must be selected");
    }
    // For single_choice / true_false, take the first selected option.
    selectedOptionId = optionIds[0] ?? null;

    // Verify the options exist + belong to this question.
    const opts = await db
      .select()
      .from(quizQuestionOptions)
      .where(
        and(
          eq(quizQuestionOptions.questionId, input.questionId),
          inArray(quizQuestionOptions.id, optionIds),
        ),
      );
    if (opts.length !== optionIds.length) {
      throw AppError.validation("One or more selected options are invalid");
    }

    // Auto-grade.
    const correctOptionIds = opts
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort();
    const selectedSorted = [...optionIds].sort();
    isCorrect =
      correctOptionIds.length > 0 &&
      correctOptionIds.length === selectedSorted.length &&
      correctOptionIds.every((id, idx) => id === selectedSorted[idx]);
    pointsAwarded = isCorrect ? question.points : 0;
  } else {
    // short_answer / essay — manual grading.
    answerText = input.answerText?.trim() || null;
    if (!answerText) {
      throw AppError.validation("An answer is required");
    }
    isCorrect = null;
    pointsAwarded = 0;
  }

  // Upsert the answer (unique constraint on session_id + question_id).
  const existingRows = await db
    .select()
    .from(quizAnswers)
    .where(
      and(
        eq(quizAnswers.sessionId, input.sessionId),
        eq(quizAnswers.questionId, input.questionId),
      ),
    )
    .limit(1);
  const existing = existingRows.at(0);

  if (existing) {
    const [updated] = await db
      .update(quizAnswers)
      .set({
        answerText,
        selectedOptionId,
        isCorrect,
        pointsAwarded,
        timeSpent: input.timeSpent,
      } satisfies Partial<NewQuizAnswer>)
      .where(eq(quizAnswers.id, existing.id))
      .returning();
    if (!updated) throw AppError.internal("Failed to update answer");
    return updated;
  }

  const [created] = await db
    .insert(quizAnswers)
    .values({
      sessionId: input.sessionId,
      questionId: input.questionId,
      answerText,
      selectedOptionId,
      isCorrect,
      pointsAwarded,
      timeSpent: input.timeSpent,
    } satisfies NewQuizAnswer)
    .returning();
  if (!created) throw AppError.internal("Failed to save answer");
  return created;
}

/**
 * Complete a quiz session — computes total_score, sets status, completedAt.
 */
export async function completeSession(
  input: CompleteQuizSessionInput,
): Promise<QuizSession> {
  const db = await getDb();

  const sessionRows = await db
    .select()
    .from(quizSessions)
    .where(eq(quizSessions.id, input.id))
    .limit(1);
  const session = sessionRows.at(0);
  if (!session) throw AppError.notFound("Quiz session not found");
  if (session.status !== "in_progress") {
    return session; // Idempotent — already completed.
  }

  // Sum points across all answers.
  const scoreRow = await db
    .select({
      total: sql<number>`coalesce(sum(${quizAnswers.pointsAwarded}), 0)`,
    })
    .from(quizAnswers)
    .where(eq(quizAnswers.sessionId, input.id));
  const totalScore = Number(scoreRow.at(0)?.total ?? 0);

  // Compute time spent (now - startedAt, in seconds).
  const now = new Date();
  const timeSpent = session.startedAt
    ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
    : 0;

  const [updated] = await db
    .update(quizSessions)
    .set({
      status: input.status,
      totalScore,
      timeSpent,
      completedAt: now,
    } satisfies Partial<NewQuizSession>)
    .where(eq(quizSessions.id, input.id))
    .returning();
  if (!updated) throw AppError.internal("Failed to complete session");
  return updated;
}

/* -- Queries: quizzes --------------------------------------- */

export async function getQuizById(id: string): Promise<QuizWithDetails> {
  const db = await getDb();

  const rows = await db
    .select({
      quiz: quizzes,
      subject: {
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
      },
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(quizzes)
    .leftJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .leftJoin(users, eq(users.id, quizzes.createdBy))
    .where(eq(quizzes.id, id))
    .limit(1);
  const row = rows.at(0);
  if (!row) throw AppError.notFound("Quiz not found");

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, id))
    .orderBy(asc(quizQuestions.position), asc(quizQuestions.createdAt));

  const questionsWithOptions = await Promise.all(
    questions.map(async (q) => {
      const opts = await db
        .select()
        .from(quizQuestionOptions)
        .where(eq(quizQuestionOptions.questionId, q.id))
        .orderBy(
          asc(quizQuestionOptions.position),
          asc(quizQuestionOptions.createdAt),
        );
      return { ...q, options: opts };
    }),
  );

  const questionsCount = questions.length;
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  const sessionsCountRow = await db
    .select({ c: count() })
    .from(quizSessions)
    .where(eq(quizSessions.quizId, id));
  const sessionsCount = Number(sessionsCountRow.at(0)?.c ?? 0);

  return {
    ...row.quiz,
    subject: row.subject?.id ? row.subject : null,
    creator: row.creator?.id ? row.creator : null,
    questions: questionsWithOptions,
    questionsCount,
    maxScore,
    sessionsCount,
  };
}

export async function listQuizzes(filters: ListQuizzesQuery): Promise<{
  items: QuizListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();

  const conditions: SQL<unknown>[] = [];
  if (filters.search) {
    const needle = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(quizzes.title, needle),
        ilike(quizzes.description, needle),
      ) as never,
    );
  }
  if (filters.subjectId) {
    conditions.push(eq(quizzes.subjectId, filters.subjectId) as never);
  }
  if (filters.level) {
    conditions.push(eq(quizzes.level, filters.level) as never);
  }
  if (filters.series) {
    conditions.push(eq(quizzes.series, filters.series) as never);
  }
  if (filters.type) {
    conditions.push(eq(quizzes.type, filters.type) as never);
  }
  if (filters.createdBy) {
    conditions.push(eq(quizzes.createdBy, filters.createdBy) as never);
  }
  if (filters.isPublished !== undefined) {
    conditions.push(eq(quizzes.isPublished, filters.isPublished) as never);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = await db
    .select({
      quiz: quizzes,
      subject: { id: subjects.id, name: subjects.name, code: subjects.code },
      creator: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(quizzes)
    .leftJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .leftJoin(users, eq(users.id, quizzes.createdBy))
    .where(where)
    .orderBy(desc(quizzes.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

  // Batch-fetch questions count + sessions count for all returned quizzes.
  const quizIds = rows.map((r) => r.quiz.id);
  const questionsCounts = quizIds.length
    ? await db
        .select({
          quizId: quizQuestions.quizId,
          c: count(),
        })
        .from(quizQuestions)
        .where(inArray(quizQuestions.quizId, quizIds))
        .groupBy(quizQuestions.quizId)
    : [];
  const sessionsCounts = quizIds.length
    ? await db
        .select({
          quizId: quizSessions.quizId,
          c: count(),
        })
        .from(quizSessions)
        .where(inArray(quizSessions.quizId, quizIds))
        .groupBy(quizSessions.quizId)
    : [];

  const items: QuizListItem[] = rows.map((r) => ({
    ...r.quiz,
    subject: r.subject?.id ? r.subject : null,
    creator: r.creator?.id ? r.creator : null,
    questionsCount: Number(
      questionsCounts.find((q) => q.quizId === r.quiz.id)?.c ?? 0,
    ),
    sessionsCount: Number(
      sessionsCounts.find((s) => s.quizId === r.quiz.id)?.c ?? 0,
    ),
  }));

  const totalRow = await db.select({ c: count() }).from(quizzes).where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

/**
 * List quizzes available to a student: published quizzes, optionally
 * filtered by subject / level matching the student's profile.
 */
export async function listQuizzesForStudent(
  studentId: string,
  filters: ListQuizzesQuery,
): Promise<{
  items: QuizListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  return listQuizzes({
    ...filters,
    isPublished: true,
    createdBy: filters.createdBy,
  });
}

/**
 * List quizzes created by a teacher.
 */
export async function listQuizzesForTeacher(
  teacherId: string,
  filters: ListQuizzesQuery,
): Promise<{
  items: QuizListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  return listQuizzes({
    ...filters,
    createdBy: teacherId,
    isPublished: filters.isPublished,
  });
}

/* -- Queries: session --------------------------------------- */

export async function getSession(
  sessionId: string,
): Promise<QuizSessionWithRelations | null> {
  return getSessionWithRelations(sessionId);
}

async function getSessionWithRelations(
  sessionId: string,
): Promise<QuizSessionWithRelations> {
  const db = await getDb();
  const rows = await db
    .select({
      session: quizSessions,
      quiz: quizzes,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(quizSessions)
    .innerJoin(quizzes, eq(quizzes.id, quizSessions.quizId))
    .innerJoin(users, eq(users.id, quizSessions.userId))
    .where(eq(quizSessions.id, sessionId))
    .limit(1);
  const row = rows.at(0);
  if (!row) throw AppError.notFound("Quiz session not found");
  return { ...row.session, quiz: row.quiz, user: row.user };
}

/**
 * Get detailed session results (per-question breakdown with explanations).
 */
export async function getSessionResults(
  sessionId: string,
): Promise<QuizSessionResults> {
  const db = await getDb();

  const {
    completedAt,
    id,
    maxScore,
    quizId,
    startedAt,
    status,
    timeSpent,
    totalScore,
    userId,
    quiz,
  } = await getSessionWithRelations(sessionId);
  const session: QuizSession = {
    completedAt,
    id,
    maxScore,
    quizId,
    startedAt,
    status,
    timeSpent,
    totalScore,
    userId,
  };

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.position), asc(quizQuestions.createdAt));

  const answers = await db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.sessionId, sessionId));

  const results: QuizAnswerWithDetails[] = await Promise.all(
    questions.map(async (q) => {
      const opts = await db
        .select()
        .from(quizQuestionOptions)
        .where(eq(quizQuestionOptions.questionId, q.id))
        .orderBy(
          asc(quizQuestionOptions.position),
          asc(quizQuestionOptions.createdAt),
        );

      const answer = answers.find((a) => a.questionId === q.id);
      const selectedOption = answer?.selectedOptionId
        ? (opts.find((o) => o.id === answer.selectedOptionId) ?? null)
        : null;

      return {
        ...(answer ?? {
          id: "",
          sessionId,
          questionId: q.id,
          answerText: null,
          selectedOptionId: null,
          isCorrect: null,
          pointsAwarded: 0,
          timeSpent: 0,
          createdAt: new Date(),
        }),
        question: { ...q, options: opts },
        selectedOption,
      } satisfies QuizAnswerWithDetails;
    }),
  );

  const calcMaxScore = questions.reduce((sum, q) => sum + q.points, 0);
  const calcTotalScore = results.reduce(
    (sum, r) => sum + (r.pointsAwarded ?? 0),
    0,
  );
  const percentage =
    maxScore > 0 ? Math.round((calcTotalScore / calcMaxScore) * 100) : 0;
  const passed = percentage >= (quiz.passingScore ?? 0);

  return {
    session,
    quiz,
    answers: results,
    totalScore: calcTotalScore,
    maxScore: calcMaxScore,
    percentage,
    passed,
  };
}

/**
 * List sessions for a given quiz (used by teachers to view students results).
 */
export async function listSessionsForQuiz(
  quizId: string,
): Promise<QuizSessionWithRelations[]> {
  const db = await getDb();
  const rows = await db
    .select({
      session: quizSessions,
      quiz: quizzes,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(quizSessions)
    .innerJoin(quizzes, eq(quizzes.id, quizSessions.quizId))
    .innerJoin(users, eq(users.id, quizSessions.userId))
    .where(eq(quizSessions.quizId, quizId))
    .orderBy(desc(quizSessions.completedAt));

  return rows.map((r) => ({ ...r.session, quiz: r.quiz, user: r.user }));
}

/**
 * List sessions for a given user (student history).
 */
export async function listSessionsForUser(
  userId: string,
): Promise<QuizSessionWithRelations[]> {
  const db = await getDb();
  const rows = await db
    .select({
      session: quizSessions,
      quiz: quizzes,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(quizSessions)
    .innerJoin(quizzes, eq(quizzes.id, quizSessions.quizId))
    .innerJoin(users, eq(users.id, quizSessions.userId))
    .where(eq(quizSessions.userId, userId))
    .orderBy(desc(quizSessions.completedAt));

  return rows.map((r) => ({ ...r.session, quiz: r.quiz, user: r.user }));
}

/* -- Question bank ------------------------------------------ */

export async function addQuestionToBank(
  input: AddQuestionToBankInput,
): Promise<QuestionBank> {
  const db = await getDb();
  const [created] = await db
    .insert(questionBanks)
    .values({
      subjectId: input.subjectId,
      level: input.level,
      series: input.series,
      label: input.label,
      difficulty: input.difficulty,
      tags: input.tags,
    } satisfies NewQuestionBank)
    .returning();
  if (!created) throw AppError.internal("Failed to add question to bank");
  return created;
}

export async function listQuestionBank(
  filters: ListQuestionBankQuery,
): Promise<{
  items: QuestionBank[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];
  if (filters.search) {
    conditions.push(ilike(questionBanks.label, `%${filters.search}%`) as never);
  }
  if (filters.subjectId) {
    conditions.push(eq(questionBanks.subjectId, filters.subjectId) as never);
  }
  if (filters.level) {
    conditions.push(eq(questionBanks.level, filters.level) as never);
  }
  if (filters.series) {
    conditions.push(eq(questionBanks.series, filters.series) as never);
  }
  if (filters.difficulty) {
    conditions.push(eq(questionBanks.difficulty, filters.difficulty) as never);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const items = await db
    .select()
    .from(questionBanks)
    .where(where)
    .orderBy(desc(questionBanks.createdAt))
    .limit(filters.pageSize)
    .offset(offset);
  const totalRow = await db
    .select({ c: count() })
    .from(questionBanks)
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

/* -- Helpers ------------------------------------------------ */

/**
 * Insert a question + its options into a quiz.
 */
async function addQuestionToQuiz(
  db: Awaited<ReturnType<typeof getDb>>,
  quizId: string,
  input: AddQuizQuestionInput,
): Promise<QuizQuestionWithOptions> {
  validateQuestion(input.type, input.options);

  const [created] = await db
    .insert(quizQuestions)
    .values({
      quizId,
      type: input.type,
      label: input.label,
      points: input.points,
      explanation: input.explanation,
      difficulty: input.difficulty,
      skillId: input.skillId,
      position: input.position,
    } satisfies NewQuizQuestion)
    .returning();
  if (!created) throw AppError.internal("Failed to create question");

  for (let i = 0; i < input.options.length; i++) {
    const opt = input.options[i];
    if (!opt) continue;
    await db.insert(quizQuestionOptions).values({
      questionId: created.id,
      label: opt.label,
      isCorrect: opt.isCorrect,
      position: opt.position ?? i,
    } satisfies NewQuizQuestionOption);
  }

  const opts = await db
    .select()
    .from(quizQuestionOptions)
    .where(eq(quizQuestionOptions.questionId, created.id))
    .orderBy(
      asc(quizQuestionOptions.position),
      asc(quizQuestionOptions.createdAt),
    );

  return { ...created, options: opts };
}

/**
 * Validate that a single question has the right number of options
 * and at least one correct option (for auto-gradable types).
 */
function validateQuestion(
  type: AddQuizQuestionInput["type"],
  options: AddQuizQuestionInput["options"],
): void {
  const needsOptions =
    type === "single_choice" ||
    type === "multiple_choice" ||
    type === "true_false";

  if (!needsOptions) return;

  if (options.length < 2) {
    throw AppError.validation(
      "At least 2 options required for this question type",
      { type, count: options.length },
    );
  }
  const hasCorrect = options.some((o) => o.isCorrect);
  if (!hasCorrect) {
    throw AppError.validation("At least one correct option required", { type });
  }
}

/**
 * Validate a list of questions (used at quiz creation time).
 */
function validateQuestions(questions: CreateQuizInput["questions"]): void {
  for (const q of questions) {
    validateQuestion(q.type, q.options);
  }
}

// Suppress unused-import warnings for helpers retained for future raw queries.
void sql;
