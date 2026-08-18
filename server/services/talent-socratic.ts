/**
 * §10.4 — Socratic AI Mentor service.
 *
 * A chatbot that guides students through their Talent Track challenges
 * using the Socratic method (asking questions instead of giving answers).
 *
 * Uses z-ai-web-dev-sdk at runtime when available; falls back to a
 * rule-based response generator when the SDK isn't installed.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  subjectSkills,
  subjects,
  socraticConversations,
  talentChallenges,
  talentProfiles,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import type { SocraticConversation } from "@/server/db/schema/talent";

/* ── Types ─────────────────────────────────────────────────── */

export interface SocraticMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export type SocraticConversationWithMessages = Omit<
  SocraticConversation,
  "messages"
> & {
  messages: SocraticMessage[];
};

/* ── Conversation lifecycle ──────────────────────────────── */

/**
 * Start a new socratic conversation. If an active one exists for the
 * same (skill, challenge), return it.
 */
export async function startConversation(
  studentId: string,
  skillId?: string,
  challengeId?: string,
  title?: string,
): Promise<SocraticConversation> {
  const db = await getDb();

  // Check for an existing active conversation on this challenge.
  if (challengeId) {
    const existing = await db
      .select()
      .from(socraticConversations)
      .where(
        and(
          eq(socraticConversations.studentId, studentId),
          eq(socraticConversations.isActive, true),
        ),
      )
      .orderBy(desc(socraticConversations.createdAt))
      .limit(5);
    const match = existing.find((c) => c.challengeId === challengeId);
    if (match) return match;
  }

  const [created] = await db
    .insert(socraticConversations)
    .values({
      studentId,
      skillId: skillId ?? null,
      challengeId: challengeId ?? null,
      title: title ?? "Conversation avec ton mentor",
      messages: { history: [] },
      messageCount: 0,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to start conversation");
  return created;
}

/**
 * List all conversations for a student.
 */
export async function listConversations(
  studentId: string,
): Promise<SocraticConversation[]> {
  const db = await getDb();
  return db
    .select()
    .from(socraticConversations)
    .where(eq(socraticConversations.studentId, studentId))
    .orderBy(desc(socraticConversations.updatedAt));
}

/**
 * Get a conversation with its messages.
 */
export async function getConversation(
  conversationId: string,
  studentId: string,
): Promise<SocraticConversationWithMessages | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(socraticConversations)
    .where(
      and(
        eq(socraticConversations.id, conversationId),
        eq(socraticConversations.studentId, studentId),
      ),
    )
    .limit(1);
  const conv = rows.at(0);
  if (!conv) return null;

  const messagesData = (conv.messages as { history?: SocraticMessage[] }) ?? {};
  return {
    ...conv,
    messages: messagesData.history ?? [],
  };
}

/* ── AI message generation ───────────────────────────────── */

interface ConversationContext {
  skillName?: string;
  subjectName?: string;
  challengeTitle?: string;
  challengeDescription?: string;
  challengeHint?: string;
  studentTier: string;
  recentMessages: SocraticMessage[];
}

/**
 * Generate the next Socratic response using the z-ai-web-dev-sdk LLM.
 * Falls back to a rule-based generator if the SDK is unavailable.
 */
export async function generateSocraticResponse(
  studentId: string,
  conversationId: string,
  userMessage: string,
): Promise<string> {
  const db = await getDb();
  const conv = await getConversation(conversationId, studentId);
  if (!conv) throw AppError.notFound("Conversation not found");

  // Build the context.
  const context = await buildContext(studentId, conv);

  // Append the user's message to the history.
  const newMessage: SocraticMessage = {
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  };
  const history = [...conv.messages, newMessage];

  // Try the LLM, fall back to rule-based.
  let assistantResponse: string;
  try {
    assistantResponse = await callLlm(userMessage, context, history);
  } catch (err) {
    logger.warn("LLM call failed, falling back to rule-based", {
      error: String(err),
    });
    assistantResponse = ruleBasedResponse(userMessage, context);
  }

  // Persist the updated history.
  const assistantMessage: SocraticMessage = {
    role: "assistant",
    content: assistantResponse,
    timestamp: new Date().toISOString(),
  };
  const updatedHistory = [...history, assistantMessage];

  await db
    .update(socraticConversations)
    .set({
      messages: { history: updatedHistory },
      messageCount: updatedHistory.length,
      updatedAt: new Date(),
    })
    .where(eq(socraticConversations.id, conversationId));

  return assistantResponse;
}

/* ── Context builder ─────────────────────────────────────── */

async function buildContext(
  studentId: string,
  conv: SocraticConversationWithMessages,
): Promise<ConversationContext> {
  const db = await getDb();

  // Get the student's tier.
  const profile = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.studentId, studentId))
    .limit(1);
  const tier = profile.at(0)?.northStarTier ?? "seedling";

  // Get the skill + subject names.
  let skillName: string | undefined;
  let subjectName: string | undefined;
  if (conv.skillId) {
    const skillRows = await db
      .select({
        skillName: subjectSkills.name,
        subjectName: subjects.name,
      })
      .from(subjectSkills)
      .leftJoin(subjects, eq(subjects.id, subjectSkills.subjectId))
      .where(eq(subjectSkills.id, conv.skillId))
      .limit(1);
    skillName = skillRows.at(0)?.skillName ?? undefined;
    subjectName = skillRows.at(0)?.subjectName ?? undefined;
  }

  // Get the challenge if linked.
  let challengeTitle: string | undefined;
  let challengeDescription: string | undefined;
  let challengeHint: string | undefined;
  if (conv.challengeId) {
    const challengeRows = await db
      .select()
      .from(talentChallenges)
      .where(eq(talentChallenges.id, conv.challengeId))
      .limit(1);
    const challenge = challengeRows.at(0);
    challengeTitle = challenge?.title;
    challengeDescription = challenge?.description;
    challengeHint = challenge?.solutionHint ?? undefined;
  }

  return {
    skillName,
    subjectName,
    challengeTitle,
    challengeDescription,
    challengeHint,
    studentTier: tier,
    recentMessages: conv.messages.slice(-6),
  };
}

import type { SocraticConversation as SocraticConversationRow } from "@/server/db/schema/talent";

type SocraticConversationWithRelations = SocraticConversationWithMessages;

/* ── LLM call (with fallback) ─────────────────────────────── */

async function callLlm(
  userMessage: string,
  context: ConversationContext,
  history: SocraticMessage[],
): Promise<string> {
  // Dynamic import so the package isn't required at build time.
  let ZAI: { default?: unknown; chat?: unknown } | null = null;
  try {
    const mod = await import("z-ai-web-dev-sdk");
    ZAI = mod as { default?: unknown; chat?: unknown };
  } catch {
    // SDK not installed — fall back to rule-based.
    return ruleBasedResponse(userMessage, context);
  }

  if (!ZAI?.chat && typeof ZAI?.default !== "function") {
    return ruleBasedResponse(userMessage, context);
  }

  const systemPrompt = buildSystemPrompt(context);
  const chatHistory = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Try the named export first (preferred shape).
    if (ZAI.chat && typeof ZAI.chat === "function") {
      const chat = (ZAI as unknown as { chat: unknown }).chat as {
        completions?: {
          create?: (params: unknown) => Promise<unknown>;
        };
      };
      if (chat?.completions?.create) {
        const result = (await chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory,
          ],
          temperature: 0.7,
          max_tokens: 500,
        } as unknown)) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = result?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.length > 0) return text.trim();
      }
    }
    // Fall back to default export.
    if (typeof ZAI.default === "function") {
      const zaiDefault = ZAI.default as unknown as () => Promise<{
        chat?: {
          completions?: {
            create?: (params: unknown) => Promise<unknown>;
          };
        };
      }>;
      const zai = await zaiDefault();
      if (zai?.chat?.completions?.create) {
        const result = (await zai.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory,
          ],
          temperature: 0.7,
          max_tokens: 500,
        } as unknown)) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = result?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.length > 0) return text.trim();
      }
    }
  } catch (err) {
    logger.warn("LLM SDK threw, falling back to rule-based", {
      error: String(err),
    });
  }

  return ruleBasedResponse(userMessage, context);
}

function buildSystemPrompt(context: ConversationContext): string {
  const parts: string[] = [
    "Tu es un mentor Socratique qui aide un élève à progresser sur son talent.",
    "Tu ne donnes JAMAIS la réponse directement.",
    "Tu poses des questions guidantes, tu encourages, tu fais réfléchir.",
    "Tu parles en français, de manière bienveillante et concise (max 3 phrases).",
  ];
  if (context.skillName) {
    parts.push(`Le talent travaillé est : ${context.skillName}.`);
  }
  if (context.subjectName) {
    parts.push(`Matière : ${context.subjectName}.`);
  }
  if (context.challengeTitle) {
    parts.push(`Challenge en cours : ${context.challengeTitle}.`);
  }
  if (context.challengeDescription) {
    parts.push(`Description du challenge : ${context.challengeDescription}`);
  }
  if (context.studentTier) {
    parts.push(`Niveau actuel de l'élève : ${context.studentTier}.`);
  }
  return parts.join(" ");
}

/* ── Rule-based fallback (offline Socratic generator) ────── */

function ruleBasedResponse(
  userMessage: string,
  context: ConversationContext,
): string {
  const msg = userMessage.toLowerCase().trim();

  // Pattern: student asks for the answer directly.
  if (
    msg.includes("donne-moi la réponse") ||
    msg.includes("quelle est la réponse") ||
    msg.includes("je veux la solution")
  ) {
    return "Je ne peux pas te donner la réponse directement — ce serait te priver du plaisir de la trouver. Mais je peux te guider : qu'as-tu essayé jusqu'ici ?";
  }

  // Pattern: student says they're stuck.
  if (
    msg.includes("je bloque") ||
    msg.includes("je comprends pas") ||
    msg.includes("je suis perdu") ||
    msg.includes("aide-moi")
  ) {
    if (context.challengeHint) {
      return `Pas de panique — c'est en séchant qu'on apprend. Voici un indice : ${context.challengeHint}. Qu'en penses-tu ?`;
    }
    return "Pas de panique — c'est en séchant qu'on apprend. Reprenons depuis le début : peux-tu me dire ce que tu sais déjà sur cette compétence ?";
  }

  // Pattern: student proposes an answer.
  if (msg.includes("je pense que") || msg.includes("ma réponse est") || msg.includes("j'ai trouvé")) {
    return "Intéressant ! Comment pourrais-tu vérifier ta réponse ? Qu'est-ce qui te fait dire que c'est correct ?";
  }

  // Pattern: student asks a "why" question.
  if (msg.startsWith("pourquoi") || msg.startsWith("pourkoi")) {
    return "Bonne question ! À ton avis, qu'est-ce qui pourrait expliquer ce phénomène ? Essaie d'imaginer une hypothèse.";
  }

  // Pattern: student asks "how".
  if (msg.startsWith("comment")) {
    return "Décomposons le problème : quelle est la première étape que tu identifies ? On y va étape par étape.";
  }

  // Default: encourage + ask guiding question.
  const skillRef = context.skillName
    ? ` sur ${context.skillName}`
    : "";
  return `Bonne réflexion${skillRef} ! Qu'est-ce qui te paraît le plus difficile dans ce que tu essaies de faire ?`;
}
