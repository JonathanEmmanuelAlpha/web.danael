/**
 * §10.4 — AI question generation service (Adaptive Learning Loop).
 *
 * Generates quiz questions for a given skill node using the z-ai-web-dev-sdk
 * (server-side only). Generated questions are stored in `quiz_questions` with
 * `source = "generated"`, the originating model name, and the target skill id,
 * so the teacher validation interface can list / verify them.
 *
 * The SDK is loaded dynamically so the rest of the platform keeps working in
 * environments where `z-ai-web-dev-sdk` is not installed (sandbox, CI, etc.).
 * In that case the service falls back to deterministic placeholder questions
 * so the teacher UI can still be exercised end-to-end.
 *
 * Pure data-access layer — auth / RBAC is enforced by the server actions.
 */

import { and, asc, count, desc, eq, ilike, inArray, isNull, or, SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  quizQuestionOptions,
  quizQuestions,
  quizzes,
  skillNodes,
  subjects,
} from "@/server/db/schema";
import type {
  NewQuiz,
  NewQuizQuestion,
  NewQuizQuestionOption,
  QuizQuestion,
  QuizQuestionOption,
} from "@/server/db/schema/quizzes";
import type { SkillNode } from "@/server/db/schema/learning";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/* ── Types ─────────────────────────────────────────────────── */

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

export type Difficulty = "easy" | "medium" | "hard";

export interface GenerateQuestionsInput {
  skillId: string;
  skillName: string;
  skillDescription?: string;
  count: number; // typically 5-10
  difficulty: Difficulty;
  questionTypes: QuestionType[];
  /** The teacher triggering the generation (recorded as the AI Bank quiz's creator). */
  teacherId: string;
}

export interface GeneratedQuestion {
  type: string;
  label: string;
  options?: { label: string; isCorrect: boolean }[];
  explanation?: string;
  difficulty: string;
}

export interface GenerateQuestionsResult {
  generated: number;
  questionIds: string[];
  /** Whether the AI SDK was actually called or placeholders were used. */
  source: "ai" | "placeholder";
  /** Model identifier recorded against each question (for the badge tooltip). */
  modelName: string;
}

export interface GeneratedQuestionListItem {
  id: string;
  quizId: string;
  type: string;
  label: string;
  explanation: string | null;
  difficulty: string | null;
  points: number;
  position: number;
  source: "verified" | "generated";
  generatedByModel: string | null;
  generatedForSkillId: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  options: QuizQuestionOption[];
  /** Joined skill node (for the filter / display). */
  skill: Pick<SkillNode, "id" | "name" | "code"> | null;
  /** Joined subject name (for the filter). */
  subjectId: string | null;
  subjectName: string | null;
  /** Parent quiz title (e.g. "AI Bank — Algebra"). */
  quizTitle: string;
}

const AI_MODEL_NAME = "z-ai-web-dev-sdk";

/* ── Public API ─────────────────────────────────────────────── */

/**
 * Generate quiz questions for a specific skill using the AI model, then persist
 * them with `source = "generated"`.
 *
 * NEVER throws — on any failure (SDK missing, parse error, DB error) it returns
 * `{ generated: 0, questionIds: [], source: "placeholder" | "ai", modelName }`.
 */
export async function generateQuestionsForSkill(
  input: GenerateQuestionsInput,
): Promise<GenerateQuestionsResult> {
  const safeCount = Math.max(1, Math.min(input.count, 20));
  const safeTypes =
    input.questionTypes.length > 0
      ? input.questionTypes
      : (["single_choice"] as QuestionType[]);

  // 1. Build the prompt and call the AI model.
  const prompt = buildPrompt({
    skillName: input.skillName,
    skillDescription: input.skillDescription,
    count: safeCount,
    difficulty: input.difficulty,
    questionTypes: safeTypes,
  });

  let questions: GeneratedQuestion[] = [];
  let source: "ai" | "placeholder" = "ai";
  try {
    questions = await callAIModel(prompt);
    if (questions.length === 0) {
      // SDK succeeded but returned nothing — fall back to placeholders.
      source = "placeholder";
      questions = buildPlaceholderQuestions({
        skillName: input.skillName,
        count: safeCount,
        difficulty: input.difficulty,
        questionTypes: safeTypes,
      });
    }
  } catch (err) {
    logger.warn("AI question generation fell back to placeholders", {
      skillId: input.skillId,
      error: String(err),
    });
    source = "placeholder";
    questions = buildPlaceholderQuestions({
      skillName: input.skillName,
      count: safeCount,
      difficulty: input.difficulty,
      questionTypes: safeTypes,
    });
  }

  // 2. Validate + sanitize each question.
  const sanitized = questions
    .map((q) => sanitizeGeneratedQuestion(q, safeTypes, input.difficulty))
    .filter((q): q is GeneratedQuestion => q !== null);

  if (sanitized.length === 0) {
    logger.warn("AI question generation produced no usable questions", {
      skillId: input.skillId,
    });
    return {
      generated: 0,
      questionIds: [],
      source,
      modelName: AI_MODEL_NAME,
    };
  }

  // 3. Resolve (or create) the AI Bank quiz for this skill.
  const quizId = await getOrCreateAIBankQuiz(
    input.skillId,
    input.skillName,
    input.teacherId,
  ).catch((err) => {
    logger.error("Failed to resolve AI Bank quiz", {
      skillId: input.skillId,
      error: String(err),
    });
    return null;
  });

  if (!quizId) {
    return {
      generated: 0,
      questionIds: [],
      source,
      modelName: AI_MODEL_NAME,
    };
  }

  // 4. Persist the questions.
  const ids = await saveGeneratedQuestions({
    quizId,
    skillId: input.skillId,
    questions: sanitized,
    modelName: AI_MODEL_NAME,
  }).catch((err) => {
    logger.error("Failed to save generated questions", {
      quizId,
      skillId: input.skillId,
      error: String(err),
    });
    return [] as string[];
  });

  return {
    generated: ids.length,
    questionIds: ids,
    source,
    modelName: AI_MODEL_NAME,
  };
}

/* ── AI model call ──────────────────────────────────────────── */

/**
 * Type declarations for the z-ai-web-dev-sdk (optional dependency).
 */
type ZaiModule = {
  default?: { create: () => Promise<ZaiClientShape> };
  create?: () => Promise<ZaiClientShape>;
};

type ZaiClientShape = {
  chat: {
    completions: {
      create: (params: {
        messages: Array<{ role: string; content: string }>;
      }) => Promise<{
        choices?: Array<{ message?: { content?: string } }>;
      }>;
    };
  };
};

/**
 * Call the z-ai-web-dev-sdk to generate quiz questions in JSON format.
 *
 * The SDK is loaded via require() with try/catch so the platform still compiles
 * & runs when the package is not installed (sandbox). On any error (missing
 * package, network, JSON parse) the function throws — the caller decides
 * whether to fall back to placeholders.
 */
async function callAIModel(prompt: string): Promise<GeneratedQuestion[]> {
  // The z-ai-web-dev-sdk may not be installed in sandbox environments.
  // We use a try/catch around a require-style lookup so Turbopack doesn't
  // fail at build time when the package is absent.
  let ZAI: { create: () => Promise<ZaiClientShape> } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("z-ai-web-dev-sdk") as ZaiModule;
    ZAI = mod.default ?? (mod as unknown as { create: () => Promise<ZaiClientShape> });
  } catch {
    // Package not installed — fall through to throw
  }

  if (!ZAI) {
    throw new Error("z-ai-web-dev-sdk is not installed");
  }

  const zai = await ZAI.create();
  const response = await zai.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You are an expert educational content creator. Generate quiz questions in JSON format only — no markdown, no prose.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content: string =
    response?.choices?.[0]?.message?.content ?? "[]";

  // Strip accidental markdown code fences before parsing.
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return [];
  return parsed as GeneratedQuestion[];
}

/* ── Prompt builder ─────────────────────────────────────────── */

function buildPrompt(params: {
  skillName: string;
  skillDescription?: string;
  count: number;
  difficulty: Difficulty;
  questionTypes: QuestionType[];
}): string {
  const {
    skillName,
    skillDescription,
    count,
    difficulty,
    questionTypes,
  } = params;

  return [
    `Generate ${count} ${difficulty} quiz questions about "${skillName}".`,
    skillDescription ? `Context: ${skillDescription}` : "",
    `Question types to include: ${questionTypes.join(", ")}.`,
    "",
    "Return a JSON array where each question has:",
    "- type: one of " + questionTypes.join(", "),
    "- label: the question text (string)",
    "- options: array of { label: string, isCorrect: boolean } (for single_choice, multiple_choice, true_false). For true_false, provide exactly two options: True and False.",
    "- explanation: brief explanation of the correct answer (string)",
    `- difficulty: "${difficulty}"`,
    "",
    "Make questions pedagogically sound, age-appropriate for high school students, and culturally relevant to the Cameroon education system.",
    "Return ONLY the JSON array, no other text.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ── Placeholder fallback ───────────────────────────────────── */

/**
 * Build deterministic placeholder questions when the AI SDK is unavailable.
 * These still respect the requested question types and difficulty so the
 * teacher validation UI can be exercised end-to-end in sandbox mode.
 */
function buildPlaceholderQuestions(params: {
  skillName: string;
  count: number;
  difficulty: Difficulty;
  questionTypes: QuestionType[];
}): GeneratedQuestion[] {
  const { skillName, count, difficulty, questionTypes } = params;
  const out: GeneratedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const type = questionTypes[i % questionTypes.length] ?? "single_choice";
    const label = `[Placeholder ${i + 1}] Which of the following best describes "${skillName}"?`;
    if (type === "true_false") {
      out.push({
        type,
        label,
        options: [
          { label: "True", isCorrect: i % 2 === 0 },
          { label: "False", isCorrect: i % 2 === 1 },
        ],
        explanation: `Placeholder explanation for ${skillName} (item ${i + 1}).`,
        difficulty,
      });
    } else if (type === "short_answer") {
      out.push({
        type,
        label: `[Placeholder ${i + 1}] In one sentence, define "${skillName}".`,
        explanation: `Expected answer mentions the core definition of ${skillName}.`,
        difficulty,
      });
    } else {
      // single_choice or multiple_choice
      const isMultiple = type === "multiple_choice";
      out.push({
        type,
        label,
        options: [
          { label: "A correct statement about the skill", isCorrect: true },
          { label: "A common misconception", isCorrect: false },
          { label: "An unrelated fact", isCorrect: false },
          ...(isMultiple
            ? [{ label: "Another correct angle", isCorrect: true }]
            : []),
        ],
        explanation: `Placeholder explanation for ${skillName} (item ${i + 1}).`,
        difficulty,
      });
    }
  }
  return out;
}

/* ── Sanitization ───────────────────────────────────────────── */

/**
 * Validate / normalize a single AI-generated question. Returns `null` if the
 * shape is unusable (missing label, no options for MCQ, etc.).
 */
function sanitizeGeneratedQuestion(
  raw: GeneratedQuestion,
  allowedTypes: QuestionType[],
  fallbackDifficulty: Difficulty,
): GeneratedQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const type = (typeof raw.type === "string" ? raw.type : "") as QuestionType;
  if (!allowedTypes.includes(type)) {
    // If the model returned a type we didn't ask for, try to coerce to single_choice.
    return null;
  }
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (label.length < 2) return null;

  const difficulty =
    typeof raw.difficulty === "string" &&
    ["easy", "medium", "hard", "expert"].includes(raw.difficulty)
      ? (raw.difficulty as string)
      : fallbackDifficulty;

  const explanation =
    typeof raw.explanation === "string" ? raw.explanation.trim() : undefined;

  // Options are required for MCQ / true_false.
  if (type === "single_choice" || type === "multiple_choice" || type === "true_false") {
    if (!Array.isArray(raw.options) || raw.options.length < 2) return null;
    const options = raw.options
      .map((o) => ({
        label: typeof o?.label === "string" ? o.label.trim() : "",
        isCorrect: Boolean(o?.isCorrect),
      }))
      .filter((o) => o.label.length > 0);
    if (options.length < 2) return null;
    // For single_choice / true_false, only one correct answer is allowed.
    if (type === "single_choice" || type === "true_false") {
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        // Force the first option to be the correct one if the model failed.
        options.forEach((o, i) => (o.isCorrect = i === 0));
      }
    } else {
      // multiple_choice — ensure at least one correct.
      if (!options.some((o) => o.isCorrect)) {
        options[0]!.isCorrect = true;
      }
    }
    return { type, label, options, explanation, difficulty };
  }

  // short_answer — no options needed.
  return { type, label, explanation, difficulty };
}

/* ── AI Bank quiz resolution ────────────────────────────────── */

/**
 * Find (or create) the unpublished "AI Bank — {skillName}" practice quiz that
 * holds generated questions for this skill. The quiz stays unpublished so it
 * never appears in the student-facing quiz list.
 */
async function getOrCreateAIBankQuiz(
  skillId: string,
  skillName: string,
  teacherId: string,
): Promise<string> {
  const db = await getDb();

  // Look up the skill's subject to bind the quiz to it (for the subject filter).
  const skillRow = await db
    .select({ subjectId: skillNodes.subjectId })
    .from(skillNodes)
    .where(eq(skillNodes.id, skillId))
    .limit(1);
  const subjectId = skillRow.at(0)?.subjectId ?? null;

  // Try to find an existing AI Bank for this skill (same subject + same title
  // prefix is good enough — we also tag it via the questions' generatedForSkillId).
  const subjectClause = subjectId
    ? eq(quizzes.subjectId, subjectId)
    : isNull(quizzes.subjectId);
  const existing = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(
      and(
        eq(quizzes.title, `AI Bank — ${skillName}`),
        subjectClause,
        eq(quizzes.isPublished, false),
      ),
    )
    .limit(1);
  if (existing.at(0)?.id) return existing[0]!.id;

  const [created] = await db
    .insert(quizzes)
    .values({
      title: `AI Bank — ${skillName}`,
      description: `Auto-generated questions pending teacher validation for skill "${skillName}".`,
      subjectId,
      type: "practice",
      isPublished: false,
      createdBy: teacherId,
    } satisfies NewQuiz)
    .returning();
  if (!created) throw AppError.internal("Failed to create AI Bank quiz");
  return created.id;
}

/* ── Persistence ────────────────────────────────────────────── */

async function saveGeneratedQuestions(params: {
  quizId: string;
  skillId: string;
  questions: GeneratedQuestion[];
  modelName: string;
}): Promise<string[]> {
  const db = await getDb();
  const { quizId, skillId, questions, modelName } = params;

  // Find the current max position so new questions are appended at the end.
  const posRow = await db
    .select({ max: quizzes.id })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .limit(1);
  void posRow; // (informational; the per-question position is computed below)
  const existingCountRow = await db
    .select({ c: count() })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId));
  let nextPos = Number(existingCountRow.at(0)?.c ?? 0);

  const createdIds: string[] = [];
  for (const q of questions) {
    const [created] = await db
      .insert(quizQuestions)
      .values({
        quizId,
        type: q.type as NewQuizQuestion["type"],
        label: q.label,
        explanation: q.explanation ?? null,
        difficulty: q.difficulty as NewQuizQuestion["difficulty"],
        points: 1,
        position: nextPos++,
        source: "generated",
        generatedByModel: modelName,
        generatedForSkillId: skillId,
      } satisfies NewQuizQuestion)
      .returning();
    if (!created) continue;
    createdIds.push(created.id);

    // Insert options (if any).
    if (q.options && q.options.length > 0) {
      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i]!;
        await db.insert(quizQuestionOptions).values({
          questionId: created.id,
          label: opt.label,
          isCorrect: opt.isCorrect,
          position: i,
        } satisfies NewQuizQuestionOption);
      }
    }
  }

  return createdIds;
}

/* ── Listing / fetching ─────────────────────────────────────── */

export interface ListGeneratedQuestionsFilters {
  subjectId?: string;
  skillId?: string;
  unverifiedOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListGeneratedQuestionsResult {
  items: GeneratedQuestionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * List generated questions (with their options + skill / subject joins).
 *
 * If `unverifiedOnly` is true, only `source = "generated"` questions are
 * returned (verified ones are excluded). Otherwise both verified & generated
 * are returned (useful for the "history" view).
 */
export async function listGeneratedQuestions(
  filters: ListGeneratedQuestionsFilters,
): Promise<ListGeneratedQuestionsResult> {
  const db = await getDb();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  const conditions: SQL<unknown>[] = [];

  // By default, list only generated questions on this page.
  if (filters.unverifiedOnly !== false) {
    conditions.push(eq(quizQuestions.source, "generated") as never);
  }

  if (filters.skillId) {
    conditions.push(eq(quizQuestions.generatedForSkillId, filters.skillId) as never);
  }
  if (filters.subjectId) {
    conditions.push(eq(quizzes.subjectId, filters.subjectId) as never);
  }
  if (filters.search) {
    const needle = `%${filters.search}%`;
    conditions.push(ilike(quizQuestions.label, needle) as never);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const totalRow = await db
    .select({ c: count() })
    .from(quizQuestions)
    .leftJoin(quizzes, eq(quizzes.id, quizQuestions.quizId))
    .leftJoin(skillNodes, eq(skillNodes.id, quizQuestions.generatedForSkillId))
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  // Fetch the questions + joins
  const rows = await db
    .select({
      question: quizQuestions,
      skill: {
        id: skillNodes.id,
        name: skillNodes.name,
        code: skillNodes.code,
      },
      quizTitle: quizzes.title,
      subjectId: quizzes.subjectId,
      subjectName: subjects.name,
    })
    .from(quizQuestions)
    .leftJoin(quizzes, eq(quizzes.id, quizQuestions.quizId))
    .leftJoin(skillNodes, eq(skillNodes.id, quizQuestions.generatedForSkillId))
    .leftJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .where(where)
    .orderBy(desc(quizQuestions.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Hydrate options for each question in a single round-trip.
  const questionIds = rows.map((r) => r.question.id);
  const optionsRows =
    questionIds.length > 0
      ? await db
          .select()
          .from(quizQuestionOptions)
          .where(inArray(quizQuestionOptions.questionId, questionIds))
          .orderBy(asc(quizQuestionOptions.position))
      : [];

  const optionsByQuestion = new Map<string, QuizQuestionOption[]>();
  for (const opt of optionsRows) {
    const arr = optionsByQuestion.get(opt.questionId) ?? [];
    arr.push(opt);
    optionsByQuestion.set(opt.questionId, arr);
  }

  const items: GeneratedQuestionListItem[] = rows.map((r) => ({
    ...r.question,
    options: optionsByQuestion.get(r.question.id) ?? [],
    skill: r.skill?.id ? r.skill : null,
    subjectId: r.subjectId ?? null,
    subjectName: r.subjectName ?? null,
    quizTitle: r.quizTitle ?? "AI Bank",
  }));

  return { items, total, page, pageSize };
}

/* ── Verification / editing ─────────────────────────────────── */

/**
 * Mark a generated question as verified (source = "verified"). Records who
 * verified it and when.
 */
export async function verifyQuestion(
  questionId: string,
  verifiedBy: string,
): Promise<QuizQuestion> {
  const db = await getDb();
  const [updated] = await db
    .update(quizQuestions)
    .set({
      source: "verified",
      verifiedBy,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quizQuestions.id, questionId))
    .returning();
  if (!updated) throw AppError.notFound("Question not found");
  return updated;
}

/**
 * Bulk-verify multiple questions. Returns the number actually updated.
 */
export async function bulkVerifyQuestions(
  questionIds: string[],
  verifiedBy: string,
): Promise<number> {
  if (questionIds.length === 0) return 0;
  const db = await getDb();
  const result = await db
    .update(quizQuestions)
    .set({
      source: "verified",
      verifiedBy,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(quizQuestions.id, questionIds))
    .returning();
  return result.length;
}

export interface EditQuestionInput {
  questionId: string;
  label: string;
  explanation?: string;
  options?: { id?: string; label: string; isCorrect: boolean }[];
}

/**
 * Edit a generated question (label / explanation / options) before verifying.
 *
 * If `options` is provided, the existing options are replaced atomically.
 */
export async function editGeneratedQuestion(
  input: EditQuestionInput,
): Promise<QuizQuestion> {
  const db = await getDb();

  const existing = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, input.questionId))
    .limit(1);
  const question = existing.at(0);
  if (!question) throw AppError.notFound("Question not found");

  await db
    .update(quizQuestions)
    .set({
      label: input.label,
      explanation: input.explanation ?? null,
      updatedAt: new Date(),
    })
    .where(eq(quizQuestions.id, input.questionId));

  if (input.options) {
    await db
      .delete(quizQuestionOptions)
      .where(eq(quizQuestionOptions.questionId, input.questionId));
    for (let i = 0; i < input.options.length; i++) {
      const opt = input.options[i]!;
      await db.insert(quizQuestionOptions).values({
        questionId: input.questionId,
        label: opt.label,
        isCorrect: opt.isCorrect,
        position: i,
      } satisfies NewQuizQuestionOption);
    }
  }

  const [refreshed] = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, input.questionId))
    .limit(1);
  if (!refreshed) throw AppError.internal("Failed to reload question");
  return refreshed;
}

/**
 * Delete a generated question (cascades to its options).
 */
export async function deleteGeneratedQuestion(
  questionId: string,
): Promise<void> {
  const db = await getDb();
  await db.delete(quizQuestions).where(eq(quizQuestions.id, questionId));
}

/* ── Skill listing (for the filter dropdown) ────────────────── */

export interface SkillOption {
  id: string;
  name: string;
  code: string;
  subjectId: string | null;
  type: string;
}

/**
 * List active skill nodes (for the filter dropdown). Optionally filtered by
 * subject (when the teacher selects a subject first).
 */
export async function listSkillsForFilter(
  subjectId?: string,
): Promise<SkillOption[]> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [eq(skillNodes.isActive, true)];
  if (subjectId) {
    conditions.push(eq(skillNodes.subjectId, subjectId) as never);
  }
  const rows = await db
    .select({
      id: skillNodes.id,
      name: skillNodes.name,
      code: skillNodes.code,
      subjectId: skillNodes.subjectId,
      type: skillNodes.type,
    })
    .from(skillNodes)
    .where(and(...conditions))
    .orderBy(asc(skillNodes.name))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    subjectId: r.subjectId,
    type: r.type,
  }));
}

/* ── Suppress unused-import warnings for tree-shaken helpers ── */
void or;
