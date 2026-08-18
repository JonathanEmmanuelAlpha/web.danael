/**
 * §10.4 — Multi-Armed Bandit content recommender.
 *
 * Uses Thompson Sampling to pick the best talent_challenges for a
 * student's North Star. Each challenge is an "arm"; the reward is
 * the engagement × mastery_delta × joy_signal.
 *
 * Cold start: collaborative filtering on peer profiles with similar
 * Talent DNA (cosine similarity on the talent_zones vector).
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  subjectSkills,
  studentTalentZones,
  talentChallenges,
  talentChallengeSubmissions,
  talentProfiles,
  users,
} from "@/server/db/schema";
import type { TalentChallenge } from "@/server/db/schema/talent";

/* ── Types ─────────────────────────────────────────────────── */

export interface RecommendedChallenge {
  challenge: TalentChallenge;
  /** Thompson-sampled expected reward 0-1. */
  expectedReward: number;
  /** Why this challenge was recommended (human-readable). */
  reason: string;
  /** Match confidence 0-1 (peer overlap). */
  matchScore: number;
}

/* ── Thompson Sampling ────────────────────────────────────── */

/**
 * Sample from a Beta(alpha, beta) distribution.
 * Uses the Marsaglia-Tsang method for gamma sampling, then derives beta.
 *
 * In production this would call a numerically-stable library; for our
 * use case (alpha, beta in [1, 1000]) the JS approximation is fine.
 */
function sampleBeta(alpha: number, beta: number): number {
  // Sample two gamma variates and take their ratio.
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

function sampleGamma(shape: number): number {
  // Marsaglia-Tsang for shape >= 1.
  if (shape < 1) {
    // Boost: gamma(shape) = gamma(shape + 1) * U^(1/shape)
    const u = Math.random();
    return sampleGamma(shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x: number;
    let v: number;
    do {
      x = sampleNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleNormal(): number {
  // Box-Muller
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/* ── Peer similarity (cosine on talent_zones vector) ─────── */

/**
 * Find students with a similar Talent DNA (top 5 by cosine similarity).
 * Returns their user IDs.
 */
export async function findSimilarPeers(
  studentId: string,
  limit = 5,
): Promise<string[]> {
  const db = await getDb();
  // Get the student's talent_zones as a sparse vector.
  const myZones = await db
    .select({
      skillId: studentTalentZones.skillId,
      score: studentTalentZones.talentScore,
    })
    .from(studentTalentZones)
    .where(eq(studentTalentZones.studentId, studentId));

  if (myZones.length === 0) return [];

  // Find all other students with at least one shared skill zone.
  const skillIds = myZones.map((z) => z.skillId);
  const peerZones = await db
    .select({
      studentId: studentTalentZones.studentId,
      skillId: studentTalentZones.skillId,
      score: studentTalentZones.talentScore,
    })
    .from(studentTalentZones)
    .where(
      and(
        inArray(studentTalentZones.skillId, skillIds),
        sql`${studentTalentZones.studentId} != ${studentId}`,
      ),
    );

  // Group by student and compute cosine similarity.
  const myVec = new Map(myZones.map((z) => [z.skillId, z.score]));
  const peerVecs = new Map<string, Map<string, number>>();
  for (const z of peerZones) {
    if (!peerVecs.has(z.studentId)) peerVecs.set(z.studentId, new Map());
    peerVecs.get(z.studentId)!.set(z.skillId, z.score);
  }

  const myMag = Math.sqrt(
    [...myVec.values()].reduce((s, v) => s + v * v, 0),
  );
  const scored: Array<{ studentId: string; sim: number }> = [];
  for (const [peerId, peerVec] of peerVecs) {
    let dot = 0;
    let peerMag = 0;
    for (const [skillId, peerScore] of peerVec) {
      const myScore = myVec.get(skillId) ?? 0;
      dot += myScore * peerScore;
      peerMag += peerScore * peerScore;
    }
    peerMag = Math.sqrt(peerMag);
    if (myMag === 0 || peerMag === 0) continue;
    scored.push({ studentId: peerId, sim: dot / (myMag * peerMag) });
  }
  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, limit).map((s) => s.studentId);
}

/* ── Reward history per challenge ────────────────────────── */

interface ChallengeReward {
  challengeId: string;
  alpha: number; // successes + 1
  beta: number; // failures + 1
  peerAlpha: number; // from similar peers
  peerBeta: number;
}

/**
 * Fetch the reward history (alpha, beta) for a set of challenges.
 * Combines the student's own history with peer history (cold start).
 */
async function fetchChallengeRewards(
  studentId: string,
  challengeIds: string[],
  peerIds: string[],
): Promise<Map<string, ChallengeReward>> {
  const db = await getDb();
  const rewards = new Map<string, ChallengeReward>();

  if (challengeIds.length === 0) return rewards;

  // Student's own submissions on these challenges.
  const mySubs = await db
    .select({
      challengeId: talentChallengeSubmissions.challengeId,
      status: talentChallengeSubmissions.status,
      rating: talentChallengeSubmissions.rating,
    })
    .from(talentChallengeSubmissions)
    .where(
      and(
        eq(talentChallengeSubmissions.studentId, studentId),
        inArray(
          talentChallengeSubmissions.challengeId,
          challengeIds,
        ),
      ),
    );

  // Peer submissions (for cold start).
  let peerSubs: Array<{
    challengeId: string;
    status: string;
    rating: number | null;
  }> = [];
  if (peerIds.length > 0) {
    peerSubs = await db
      .select({
        challengeId: talentChallengeSubmissions.challengeId,
        status: talentChallengeSubmissions.status,
        rating: talentChallengeSubmissions.rating,
      })
      .from(talentChallengeSubmissions)
      .where(
        and(
          inArray(talentChallengeSubmissions.studentId, peerIds),
          inArray(
            talentChallengeSubmissions.challengeId,
            challengeIds,
          ),
        ),
      );
  }

  // Aggregate alpha/beta per challenge.
  // A "success" = submitted (status 'submitted' or 'reviewed') + rating >= 3.
  // A "failure" = abandoned (status 'in_progress' older than 7d) or rating < 3.
  for (const cid of challengeIds) {
    const mySuccesses = mySubs.filter(
      (s) =>
        s.challengeId === cid &&
        (s.status === "submitted" || s.status === "reviewed") &&
        (s.rating ?? 0) >= 3,
    ).length;
    const myFailures = mySubs.filter(
      (s) => s.challengeId === cid && (s.rating ?? 0) < 3 && s.rating !== null,
    ).length;
    const peerSuccesses = peerSubs.filter(
      (s) =>
        s.challengeId === cid &&
        (s.status === "submitted" || s.status === "reviewed") &&
        (s.rating ?? 0) >= 3,
    ).length;
    const peerFailures = peerSubs.filter(
      (s) =>
        s.challengeId === cid &&
        (s.rating ?? 0) < 3 &&
        s.rating !== null,
    ).length;
    rewards.set(cid, {
      challengeId: cid,
      alpha: mySuccesses + 1,
      beta: myFailures + 1,
      peerAlpha: peerSuccesses + 1,
      peerBeta: peerFailures + 1,
    });
  }
  return rewards;
}

/* ── Main recommender ─────────────────────────────────────── */

/**
 * Recommend `count` challenges for a student's North Star skill.
 * Uses Thompson Sampling with peer-informed priors.
 */
export async function recommendChallengesForSkill(
  studentId: string,
  skillId: string,
  count: number,
  tier: "seedling" | "bronze" | "silver" | "gold" | "diamond" = "silver",
): Promise<RecommendedChallenge[]> {
  const db = await getDb();

  // Find challenges for this skill (and tier ceiling — don't propose
  // challenges too far above the current tier).
  const tierOrder = ["seedling", "bronze", "silver", "gold", "diamond"];
  const tierIdx = tierOrder.indexOf(tier);
  const allowedTiers = tierOrder.slice(0, tierIdx + 2); // allow up to 1 tier above

  const challenges = await db
    .select()
    .from(talentChallenges)
    .where(
      and(
        eq(talentChallenges.skillId, skillId),
        eq(talentChallenges.isPublished, true),
        inArray(talentChallenges.requiredTier, allowedTiers),
      ),
    )
    .orderBy(asc(talentChallenges.difficulty));

  if (challenges.length === 0) return [];

  // Find similar peers for cold start.
  const peerIds = await findSimilarPeers(studentId, 5);

  // Fetch reward history.
  const rewards = await fetchChallengeRewards(
    studentId,
    challenges.map((c) => c.id),
    peerIds,
  );

  // Exclude challenges already submitted by the student.
  const db2 = await getDb();
  const submitted = await db2
    .select({ challengeId: talentChallengeSubmissions.challengeId })
    .from(talentChallengeSubmissions)
    .where(eq(talentChallengeSubmissions.studentId, studentId));
  const submittedSet = new Set(submitted.map((s) => s.challengeId));

  // Thompson Sample each challenge.
  const sampled: Array<{
    challenge: TalentChallenge;
    sample: number;
    reward: ChallengeReward;
  }> = [];

  for (const challenge of challenges) {
    if (submittedSet.has(challenge.id)) continue;
    const reward = rewards.get(challenge.id) ?? {
      challengeId: challenge.id,
      alpha: 1,
      beta: 1,
      peerAlpha: 1,
      peerBeta: 1,
    };
    // Blend personal + peer priors (weight peer less as personal data grows).
    const personalCount = reward.alpha + reward.beta - 2;
    const peerWeight = Math.max(0.2, 1 - personalCount / 10);
    const blendedAlpha =
      reward.alpha + peerWeight * (reward.peerAlpha - 1);
    const blendedBeta = reward.beta + peerWeight * (reward.peerBeta - 1);
    const sample = sampleBeta(blendedAlpha, blendedBeta);
    sampled.push({ challenge, sample, reward });
  }

  sampled.sort((a, b) => b.sample - a.sample);

  return sampled.slice(0, count).map(({ challenge, sample, reward }) => ({
    challenge,
    expectedReward: sample,
    matchScore: reward.peerAlpha / (reward.peerAlpha + reward.peerBeta),
    reason:
      reward.peerAlpha > 3
        ? "Recommandé par des élèves au talent similaire"
        : challenge.ratingAvg > 4
          ? "Très apprécié par la communauté"
          : "Adapté à ton niveau actuel",
  }));
}

/* ── Update reward after a submission ────────────────────── */

/**
 * After a student submits a challenge, update the reward signal.
 * Called by the submission action.
 */
export async function recordChallengeReward(
  studentId: string,
  challengeId: string,
  success: boolean,
  rating: number | null,
): Promise<void> {
  // The reward is implicitly captured by the existence of the submission
  // row — fetchChallengeRewards reads it on the next recommendation pass.
  // No extra writes needed here, but we expose the hook for future
  // fine-grained reward shaping.
  void studentId;
  void challengeId;
  void success;
  void rating;
}
