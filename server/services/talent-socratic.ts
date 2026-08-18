/**
 * §10.4 — Socratic AI Mentor service.
 *
 * A chatbot that guides students through their Talent Track challenges
 * using the Socratic method (asking questions instead of giving answers).
 *
 * Uses the DeepSeek API (via OpenAI SDK) at runtime; falls back to a
 * rule-based response generator when the API key is missing or the call fails.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import OpenAI from "openai";

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

export type Locale = "en" | "fr";

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
 * Generate the next Socratic response using the DeepSeek API (via OpenAI SDK).
 * Falls back to a rule-based generator if the API key is missing or the call fails.
 *
 * @param locale - Language for the response ('en' or 'fr'), default 'fr' (legacy).
 */
export async function generateSocraticResponse(
  studentId: string,
  conversationId: string,
  userMessage: string,
  locale: Locale = "fr",
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
    assistantResponse = await callLlm(userMessage, context, history, locale);
  } catch (err) {
    logger.warn("LLM call failed, falling back to rule-based", {
      error: String(err),
    });
    assistantResponse = ruleBasedResponse(userMessage, context, locale);
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

/* ── LLM call using DeepSeek API ──────────────────────────── */

async function callLlm(
  userMessage: string,
  context: ConversationContext,
  history: SocraticMessage[],
  locale: Locale,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY environment variable is not set");
  }

  const client = new OpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey,
  });

  const systemPrompt = buildSystemPrompt(context, locale);
  const chatHistory = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [{ role: "system", content: systemPrompt }, ...chatHistory],
    temperature: 0.7,
    max_tokens: 500,
  });

  const text = response.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.length > 0) {
    return text.trim();
  }
  throw new Error("Empty response from DeepSeek API");
}

/* ── System prompt builder (i18n) ────────────────────────── */

function buildSystemPrompt(
  context: ConversationContext,
  locale: Locale,
): string {
  const isFrench = locale === "fr";

  const lines: string[] = [];
  if (isFrench) {
    lines.push(
      "Tu es un mentor Socratique qui aide un élève à progresser sur son talent.",
      "Tu ne donnes JAMAIS la réponse directement.",
      "Tu poses des questions guidantes, tu encourages, tu fais réfléchir.",
      "Tu parles en français, de manière bienveillante et concise (max 3 phrases).",
    );
  } else {
    lines.push(
      "You are a Socratic mentor helping a student progress in their talent.",
      "You NEVER give the answer directly.",
      "You ask guiding questions, encourage, and make the student think.",
      "You speak in English, kindly and concisely (max 3 sentences).",
    );
  }

  if (context.skillName) {
    lines.push(
      isFrench
        ? `Le talent travaillé est : ${context.skillName}.`
        : `The skill being worked on is: ${context.skillName}.`,
    );
  }
  if (context.subjectName) {
    lines.push(
      isFrench
        ? `Matière : ${context.subjectName}.`
        : `Subject: ${context.subjectName}.`,
    );
  }
  if (context.challengeTitle) {
    lines.push(
      isFrench
        ? `Challenge en cours : ${context.challengeTitle}.`
        : `Current challenge: ${context.challengeTitle}.`,
    );
  }
  if (context.challengeDescription) {
    lines.push(
      isFrench
        ? `Description du challenge : ${context.challengeDescription}`
        : `Challenge description: ${context.challengeDescription}`,
    );
  }
  if (context.studentTier) {
    lines.push(
      isFrench
        ? `Niveau actuel de l'élève : ${context.studentTier}.`
        : `Current student level: ${context.studentTier}.`,
    );
  }
  return lines.join(" ");
}

/* ── Rule-based fallback (offline Socratic generator) i18n ── */

function ruleBasedResponse(
  userMessage: string,
  context: ConversationContext,
  locale: Locale,
): string {
  const msg = userMessage.toLowerCase().trim();
  const isFrench = locale === "fr";

  // Patterns: student asks for the answer directly.
  if (
    msg.includes("donne-moi la réponse") ||
    msg.includes("quelle est la réponse") ||
    msg.includes("je veux la solution") ||
    (locale === "en" &&
      (msg.includes("give me the answer") ||
        msg.includes("what is the answer") ||
        msg.includes("i want the solution")))
  ) {
    return isFrench
      ? "Je ne peux pas te donner la réponse directement — ce serait te priver du plaisir de la trouver. Mais je peux te guider : qu'as-tu essayé jusqu'ici ?"
      : "I can't give you the answer directly — that would rob you of the joy of finding it. But I can guide you: what have you tried so far?";
  }

  // Patterns: student says they're stuck.
  if (
    msg.includes("je bloque") ||
    msg.includes("je comprends pas") ||
    msg.includes("je suis perdu") ||
    msg.includes("aide-moi") ||
    (locale === "en" &&
      (msg.includes("i'm stuck") ||
        msg.includes("i don't understand") ||
        msg.includes("i'm lost") ||
        msg.includes("help me")))
  ) {
    if (context.challengeHint) {
      return isFrench
        ? `Pas de panique — c'est en séchant qu'on apprend. Voici un indice : ${context.challengeHint}. Qu'en penses-tu ?`
        : `Don't panic — we learn by struggling. Here's a hint: ${context.challengeHint}. What do you think?`;
    }
    return isFrench
      ? "Pas de panique — c'est en séchant qu'on apprend. Reprenons depuis le début : peux-tu me dire ce que tu sais déjà sur cette compétence ?"
      : "Don't panic — we learn by struggling. Let's start from the beginning: can you tell me what you already know about this skill?";
  }

  // Patterns: student proposes an answer.
  if (
    msg.includes("je pense que") ||
    msg.includes("ma réponse est") ||
    msg.includes("j'ai trouvé") ||
    (locale === "en" &&
      (msg.includes("i think that") ||
        msg.includes("my answer is") ||
        msg.includes("i found")))
  ) {
    return isFrench
      ? "Intéressant ! Comment pourrais-tu vérifier ta réponse ? Qu'est-ce qui te fait dire que c'est correct ?"
      : "Interesting! How could you verify your answer? What makes you think it's correct?";
  }

  // Patterns: "why" question.
  if (
    msg.startsWith("pourquoi") ||
    msg.startsWith("pourkoi") ||
    (locale === "en" && msg.startsWith("why"))
  ) {
    return isFrench
      ? "Bonne question ! À ton avis, qu'est-ce qui pourrait expliquer ce phénomène ? Essaie d'imaginer une hypothèse."
      : "Good question! In your opinion, what could explain this phenomenon? Try to imagine a hypothesis.";
  }

  // Patterns: "how" question.
  if (msg.startsWith("comment") || (locale === "en" && msg.startsWith("how"))) {
    return isFrench
      ? "Décomposons le problème : quelle est la première étape que tu identifies ? On y va étape par étape."
      : "Let's break down the problem: what is the first step you identify? We'll go step by step.";
  }

  // Default: encourage + ask guiding question.
  const skillRef = context.skillName
    ? isFrench
      ? ` sur ${context.skillName}`
      : ` on ${context.skillName}`
    : "";
  return isFrench
    ? `Bonne réflexion${skillRef} ! Qu'est-ce qui te paraît le plus difficile dans ce que tu essaies de faire ?`
    : `Good thinking${skillRef}! What seems most difficult about what you're trying to do?`;
}
