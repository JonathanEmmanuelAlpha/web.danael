/**
 * §10.3 — Quiz validators (Zod v4).
 */

import { z } from "zod";

import {
  QUIZ_TYPE_VALUES,
  QUIZ_QUESTION_TYPE_VALUES,
  LEVEL_VALUES,
  SERIES_VALUES,
  DIFFICULTY_VALUES,
} from "@/server/db/schema/enums";

/* -- Option shape (shared between create + update question) -- */

export const quizOptionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(500),
  isCorrect: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
});
export type QuizOptionInput = z.infer<typeof quizOptionSchema>;

/* -- Question shape (shared between create + update) -------- */

export const quizQuestionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(QUIZ_QUESTION_TYPE_VALUES).default("single_choice"),
  label: z.string().min(2, "Label required").max(1000),
  points: z.number().int().min(0).max(100).default(1),
  explanation: z.string().max(2000).optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).default("medium"),
  position: z.number().int().min(0).default(0),
  options: z.array(quizOptionSchema).max(10).default([]),
});
export type QuizQuestionInput = z.infer<typeof quizQuestionSchema>;

/* -- Quiz create / update ----------------------------------- */

/**
 * Create a new quiz with its questions + options in a single payload.
 * `createdBy` is injected by the server action (never trusted from client).
 */
export const createQuizSchema = z.object({
  title: z.string().min(2, "Title too short").max(200),
  description: z.string().max(2000).optional(),
  subjectId: z.uuid().optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  type: z.enum(QUIZ_TYPE_VALUES).default("practice"),
  timeLimitMinutes: z.number().int().min(0).max(600).optional(),
  passingScore: z.number().int().min(0).max(100).default(50),
  isPublished: z.boolean().default(false),
  questions: z.array(quizQuestionSchema).max(50).default([]),
});

/**
 * Update an existing quiz. Questions are managed separately
 * (add/update/remove) so the form can support partial edits.
 *
 * If `questions` is provided, ALL existing questions are replaced atomically
 * (only allowed when the quiz has no sessions).
 */
export const updateQuizSchema = z.object({
  id: z.uuid(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  subjectId: z.uuid().nullable().optional(),
  level: z.enum(LEVEL_VALUES).nullable().optional(),
  series: z.enum(SERIES_VALUES).nullable().optional(),
  type: z.enum(QUIZ_TYPE_VALUES).optional(),
  timeLimitMinutes: z.number().int().min(0).max(600).nullable().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  isPublished: z.boolean().optional(),
  questions: z.array(quizQuestionSchema).max(50).optional(),
});

/**
 * Add a question to a quiz (with nested options).
 */
export const addQuizQuestionSchema = z.object({
  quizId: z.uuid(),
  type: z.enum(QUIZ_QUESTION_TYPE_VALUES).default("single_choice"),
  label: z.string().min(2, "Label required").max(1000),
  points: z.number().int().min(0).max(100).default(1),
  explanation: z.string().max(2000).optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).default("medium"),
  position: z.number().int().min(0).default(0),
  options: z.array(quizOptionSchema).max(10).default([]),
});

/**
 * Update an existing question.
 */
export const updateQuizQuestionSchema = z.object({
  id: z.uuid(),
  quizId: z.uuid().optional(),
  type: z.enum(QUIZ_QUESTION_TYPE_VALUES).default("single_choice"),
  label: z.string().min(2).max(1000).optional(),
  points: z.number().int().min(0).max(100).optional(),
  explanation: z.string().max(2000).nullable().optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).optional(),
  position: z.number().int().min(0).optional(),
  options: z.array(quizOptionSchema).max(10).default([]),
});

/**
 * List quizzes with filters. Used by teachers, students and admins.
 */
export const listQuizzesQuerySchema = z.object({
  search: z.string().max(200).optional(),
  subjectId: z.uuid().optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  type: z.enum(QUIZ_TYPE_VALUES).optional(),
  createdBy: z.uuid().optional(),
  studentId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
  isPublished: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/* -- Quiz session ------------------------------------------- */

/**
 * Start a new quiz session (attempt).
 * `userId` is injected by the server action.
 */
export const startQuizSessionSchema = z.object({
  quizId: z.uuid(),
  userId: z.uuid(),
});

/**
 * Submit one answer within a session.
 * Either `selectedOptionId` (single_choice / true_false) OR
 * `selectedOptionIds` (multiple_choice) OR `answerText` (short_answer / essay).
 */
export const submitQuizAnswerSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
  answerText: z.string().max(5000).optional(),
  selectedOptionId: z.uuid().optional(),
  selectedOptionIds: z.array(z.uuid()).max(10).optional(),
  timeSpent: z.number().int().min(0).default(0),
});

/**
 * Complete a quiz session (compute score, mark as completed).
 */
export const completeQuizSessionSchema = z.object({
  id: z.uuid(),
  status: z.enum(["completed", "abandoned"]).default("completed"),
});

/* -- Question bank ------------------------------------------- */

/**
 * Add a reusable question to the question bank.
 */
export const addQuestionToBankSchema = z.object({
  subjectId: z.uuid().optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  label: z.string().min(2).max(1000),
  difficulty: z.enum(DIFFICULTY_VALUES).default("medium"),
  tags: z.array(z.string().min(1).max(60)).max(10).default([]),
});

/**
 * List question bank entries with filters.
 */
export const listQuestionBankQuerySchema = z.object({
  search: z.string().max(200).optional(),
  subjectId: z.uuid().optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type AddQuizQuestionInput = z.infer<typeof addQuizQuestionSchema>;
export type UpdateQuizQuestionInput = z.infer<typeof updateQuizQuestionSchema>;
export type ListQuizzesQuery = z.infer<typeof listQuizzesQuerySchema>;
export type StartQuizSessionInput = z.infer<typeof startQuizSessionSchema>;
export type SubmitQuizAnswerInput = z.infer<typeof submitQuizAnswerSchema>;
export type CompleteQuizSessionInput = z.infer<
  typeof completeQuizSessionSchema
>;
export type AddQuestionToBankInput = z.infer<typeof addQuestionToBankSchema>;
export type ListQuestionBankQuery = z.infer<typeof listQuestionBankQuerySchema>;
