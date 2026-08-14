/**
 * §5.7 — Competitions service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Responsibilities:
 *  - CRUD on competitions
 *  - Status transitions (draft → scheduled → active → ended/cancelled)
 *  - Participant join / score submission
 *  - Leaderboard computation (with anonymous support)
 *  - Finalization (rank assignment + XP awarding to top 3)
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  SQL,
  sql,
} from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  competitions,
  competitionParticipants,
  users,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import * as gamificationService from "@/server/services/gamification";
import type {
  CreateCompetitionInput,
  ListCompetitionsQuery,
  UpdateCompetitionInput,
} from "@/server/validators/competitions";
import type {
  Competition,
  CompetitionParticipant,
} from "@/server/db/schema/competitions";
import type { User } from "@/server/db/schema/users";

/* ── Types ─────────────────────────────────────────────────── */

export type { Competition, CompetitionParticipant };

export type CompetitionWithCounts = Competition & {
  participantsCount: number;
  creator?: Pick<User, "id" | "firstName" | "lastName"> | null;
};

export type CompetitionListItem = Pick<
  Competition,
  | "id"
  | "title"
  | "description"
  | "scope"
  | "level"
  | "series"
  | "schoolId"
  | "startAt"
  | "endAt"
  | "status"
  | "prizeDescription"
  | "createdAt"
> & {
  participantsCount: number;
};

export type CompetitionListResult = {
  items: CompetitionListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type ParticipantWithUser = CompetitionParticipant & {
  user: Pick<User, "id" | "firstName" | "lastName" | "avatarUrl">;
  displayName: string;
};

export type RankedParticipant = ParticipantWithUser & {
  rank: number;
};

/* ── Mutations: competitions ────────────────────────────────── */

/**
 * Create a new competition. `creatorId` is stored as the schoolId-less
 * originator (the schoolId field optionally scopes the competition to a school).
 */
export async function createCompetition(
  input: CreateCompetitionInput,
  creatorId: string,
): Promise<Competition> {
  const db = await getDb();

  const [created] = await db
    .insert(competitions)
    .values({
      title: input.title,
      description: input.description,
      scope: input.scope,
      level: input.level,
      series: input.series,
      schoolId: input.schoolId,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      status: "draft",
      prizeDescription: input.prizeDescription,
    })
    .returning();

  if (!created) throw AppError.internal("Failed to create competition");
  void creatorId; // reserved for future audit-log integration
  return created;
}

/**
 * Get a competition by id with the participant count.
 */
export async function getCompetitionById(
  id: string,
): Promise<CompetitionWithCounts> {
  const db = await getDb();

  const rows = await db
    .select({
      competition: competitions,
      participantsCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${competitionParticipants}
        WHERE ${competitionParticipants.competitionId} = ${competitions.id}
      )`,
    })
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);

  const row = rows.at(0);
  if (!row) throw AppError.notFound("Competition not found");

  return {
    ...row.competition,
    participantsCount: row.participantsCount ?? 0,
  };
}

/**
 * List competitions with filters + pagination.
 */
export async function listCompetitions(
  filters: ListCompetitionsQuery,
): Promise<CompetitionListResult> {
  const db = await getDb();

  const conditions: SQL<unknown>[] = [];
  if (filters.search) {
    const needle = `%${filters.search}%`;
    // SQLite ILIKE workaround: use lower() + LIKE.
    conditions.push(
      sql`LOWER(${competitions.title}) LIKE LOWER(${needle})` as never,
    );
  }
  if (filters.scope) {
    conditions.push(eq(competitions.scope, filters.scope) as never);
  }
  if (filters.status) {
    conditions.push(eq(competitions.status, filters.status) as never);
  }
  if (filters.level) {
    conditions.push(eq(competitions.level, filters.level) as never);
  }
  if (filters.series) {
    conditions.push(eq(competitions.series, filters.series) as never);
  }
  if (filters.schoolId) {
    conditions.push(eq(competitions.schoolId, filters.schoolId) as never);
  }

  // Filter by user participation.
  if (filters.userId) {
    conditions.push(
      inArray(
        competitions.id,
        db
          .select({ id: competitionParticipants.competitionId })
          .from(competitionParticipants)
          .where(eq(competitionParticipants.userId, filters.userId)),
      ) as never,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = await db
    .select({
      id: competitions.id,
      title: competitions.title,
      description: competitions.description,
      scope: competitions.scope,
      level: competitions.level,
      series: competitions.series,
      schoolId: competitions.schoolId,
      startAt: competitions.startAt,
      endAt: competitions.endAt,
      status: competitions.status,
      prizeDescription: competitions.prizeDescription,
      createdAt: competitions.createdAt,
      participantsCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${competitionParticipants}
        WHERE ${competitionParticipants.competitionId} = ${competitions.id}
      )`,
    })
    .from(competitions)
    .where(where)
    .orderBy(desc(competitions.startAt))
    .limit(filters.pageSize)
    .offset(offset);

  const totalRow = await db
    .select({ c: count() })
    .from(competitions)
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  return {
    items: rows.map((r) => ({
      ...r,
      participantsCount: r.participantsCount ?? 0,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/**
 * List currently-active competitions (status=active AND now is between
 * start_at and end_at).
 */
export async function listActiveCompetitions(): Promise<CompetitionListItem[]> {
  const db = await getDb();
  const now = new Date();

  const rows = await db
    .select({
      id: competitions.id,
      title: competitions.title,
      description: competitions.description,
      scope: competitions.scope,
      level: competitions.level,
      series: competitions.series,
      schoolId: competitions.schoolId,
      startAt: competitions.startAt,
      endAt: competitions.endAt,
      status: competitions.status,
      prizeDescription: competitions.prizeDescription,
      createdAt: competitions.createdAt,
      participantsCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${competitionParticipants}
        WHERE ${competitionParticipants.competitionId} = ${competitions.id}
      )`,
    })
    .from(competitions)
    .where(
      and(
        eq(competitions.status, "active"),
        lte(competitions.startAt, now),
        gte(competitions.endAt, now),
      ),
    )
    .orderBy(asc(competitions.endAt));

  return rows.map((r) => ({
    ...r,
    participantsCount: r.participantsCount ?? 0,
  }));
}

/**
 * Update editable competition fields.
 */
export async function updateCompetition(
  id: string,
  input: UpdateCompetitionInput,
): Promise<Competition> {
  const db = await getDb();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.scope !== undefined) updates.scope = input.scope;
  if (input.level !== undefined) updates.level = input.level;
  if (input.series !== undefined) updates.series = input.series;
  if (input.schoolId !== undefined) updates.schoolId = input.schoolId;
  if (input.startAt !== undefined) updates.startAt = new Date(input.startAt);
  if (input.endAt !== undefined) updates.endAt = new Date(input.endAt);
  if (input.status !== undefined) updates.status = input.status;
  if (input.prizeDescription !== undefined)
    updates.prizeDescription = input.prizeDescription;

  const [updated] = await db
    .update(competitions)
    .set(updates)
    .where(eq(competitions.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Competition not found");
  return updated;
}

/**
 * Soft-delete a competition (we hard delete — competitions are user-generated
 * and not legally significant; cascade removes participants).
 */
export async function deleteCompetition(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(competitions).where(eq(competitions.id, id));
}

/**
 * Publish a competition: status draft → scheduled (or → active if start date
 * has passed).
 */
export async function publishCompetition(id: string): Promise<Competition> {
  const db = await getDb();
  const current = await getCompetitionById(id);
  if (current.status !== "draft" && current.status !== "scheduled") {
    throw AppError.conflict(
      `Competition cannot be published from status "${current.status}"`,
    );
  }

  const now = new Date();
  const nextStatus = now >= current.startAt ? "active" : "scheduled";

  const [updated] = await db
    .update(competitions)
    .set({ status: nextStatus, updatedAt: now })
    .where(eq(competitions.id, id))
    .returning();
  if (!updated) throw AppError.internal("Failed to publish competition");
  return updated;
}

/* ── Participants ──────────────────────────────────────────── */

/**
 * Join a competition. Idempotent — if already joined, returns the existing
 * participant row.
 */
export async function joinCompetition(
  competitionId: string,
  userId: string,
  isAnonymous = false,
): Promise<CompetitionParticipant> {
  const db = await getDb();
  const competition = await getCompetitionById(competitionId);

  // Validate the competition is joinable.
  if (competition.status === "ended" || competition.status === "cancelled") {
    throw AppError.conflict("Competition is no longer open for registration");
  }
  const now = new Date();
  if (now > competition.endAt) {
    throw AppError.conflict("Competition has ended");
  }

  // Check existing participation.
  const existing = await db
    .select()
    .from(competitionParticipants)
    .where(
      and(
        eq(competitionParticipants.competitionId, competitionId),
        eq(competitionParticipants.userId, userId),
      ),
    )
    .limit(1);
  if (existing.at(0)) {
    return existing[0]!;
  }

  const [created] = await db
    .insert(competitionParticipants)
    .values({
      competitionId,
      userId,
      score: 0,
      isAnonymous,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to join competition");

  // Award XP for participation.
  await gamificationService.awardXp(userId, 25, "Joined competition");
  await gamificationService.logActivity(
    userId,
    "join_class",
    "competition",
    competitionId,
    { title: competition.title },
  );

  return created;
}

/**
 * Submit / update a competition score.
 * Updates the score and the submittedAt timestamp.
 */
export async function submitCompetitionScore(
  competitionId: string,
  userId: string,
  score: number,
): Promise<CompetitionParticipant> {
  const db = await getDb();

  // Verify the participant exists.
  const existing = await db
    .select()
    .from(competitionParticipants)
    .where(
      and(
        eq(competitionParticipants.competitionId, competitionId),
        eq(competitionParticipants.userId, userId),
      ),
    )
    .limit(1);
  const participant = existing.at(0);
  if (!participant) {
    throw AppError.notFound("You have not joined this competition");
  }

  const [updated] = await db
    .update(competitionParticipants)
    .set({
      score,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(competitionParticipants.id, participant.id))
    .returning();
  if (!updated) throw AppError.internal("Failed to submit score");

  return updated;
}

/**
 * Get the ranked leaderboard for a competition.
 *
 * Participants are sorted by score desc, then by submittedAt asc (earlier
 * submission wins ties). Anonymous participants have their displayName masked.
 */
export async function getLeaderboard(
  competitionId: string,
): Promise<RankedParticipant[]> {
  const db = await getDb();

  const rows = await db
    .select({
      participant: competitionParticipants,
      user: users,
    })
    .from(competitionParticipants)
    .innerJoin(users, eq(users.id, competitionParticipants.userId))
    .where(eq(competitionParticipants.competitionId, competitionId))
    .orderBy(
      desc(competitionParticipants.score),
      asc(competitionParticipants.submittedAt),
    );

  return rows.map((r, idx) => {
    const isAnonymous = r.participant.isAnonymous;
    const fullName = [r.user.firstName, r.user.lastName]
      .filter(Boolean)
      .join(" ");
    const displayName = isAnonymous ? "Anonyme" : fullName || "—";
    return {
      ...r.participant,
      rank: idx + 1,
      user: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        avatarUrl: r.user.avatarUrl,
      },
      displayName,
    };
  });
}

/**
 * Finalize a competition:
 *  - Assigns the final rank to each participant (based on score + submission time).
 *  - Awards bonus XP to the top 3 (500 / 300 / 150).
 *  - Sets status to ended.
 */
export async function finalizeCompetition(
  competitionId: string,
): Promise<{ competition: Competition; ranked: RankedParticipant[] }> {
  const db = await getDb();
  const competition = await getCompetitionById(competitionId);

  if (competition.status === "ended" || competition.status === "cancelled") {
    throw AppError.conflict("Competition already finalized or cancelled");
  }

  // Get ranked participants.
  const ranked = await getLeaderboard(competitionId);

  // Assign ranks + award XP.
  const xpRewards = [500, 300, 150];
  for (const r of ranked) {
    await db
      .update(competitionParticipants)
      .set({ rank: r.rank, updatedAt: new Date() })
      .where(eq(competitionParticipants.id, r.id));

    if (r.rank <= 3) {
      const xp = xpRewards[r.rank - 1]!;
      await gamificationService
        .awardXp(
          r.userId,
          xp,
          `Competition rank #${r.rank}: ${competition.title}`,
        )
        .catch(() => undefined);
      await gamificationService
        .logActivity(
          r.userId,
          "earn_badge",
          "competition_rank",
          competitionId,
          {
            rank: r.rank,
            title: competition.title,
            xpReward: xp,
          },
        )
        .catch(() => undefined);
    }
  }

  // Mark competition as ended.
  const [updated] = await db
    .update(competitions)
    .set({ status: "ended", updatedAt: new Date() })
    .where(eq(competitions.id, competitionId))
    .returning();
  if (!updated) throw AppError.internal("Failed to finalize competition");

  return { competition: updated, ranked };
}

/**
 * List all competitions a user has joined (for "My competitions" tab).
 */
export async function listUserCompetitions(
  userId: string,
): Promise<CompetitionListItem[]> {
  const db = await getDb();

  const rows = await db
    .select({
      id: competitions.id,
      title: competitions.title,
      description: competitions.description,
      scope: competitions.scope,
      level: competitions.level,
      series: competitions.series,
      schoolId: competitions.schoolId,
      startAt: competitions.startAt,
      endAt: competitions.endAt,
      status: competitions.status,
      prizeDescription: competitions.prizeDescription,
      createdAt: competitions.createdAt,
      participantsCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${competitionParticipants}
        WHERE ${competitionParticipants.competitionId} = ${competitions.id}
      )`,
      score: competitionParticipants.score,
      rank: competitionParticipants.rank,
    })
    .from(competitions)
    .innerJoin(
      competitionParticipants,
      eq(competitionParticipants.competitionId, competitions.id),
    )
    .where(eq(competitionParticipants.userId, userId))
    .orderBy(desc(competitions.endAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    scope: r.scope,
    level: r.level,
    series: r.series,
    schoolId: r.schoolId,
    startAt: r.startAt,
    endAt: r.endAt,
    status: r.status,
    prizeDescription: r.prizeDescription,
    createdAt: r.createdAt,
    participantsCount: r.participantsCount ?? 0,
  }));
}
