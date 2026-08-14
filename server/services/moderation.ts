/**
 * §5.16 — Moderation service.
 *
 * Generic community moderation queue (distinct from content_reports which is
 * content-specific). Handles reports on messages, users, reviews, testimonies
 * and contents.
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 */

import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  moderationReports,
  users,
  contents,
  messages,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type { ModerationReport } from "@/server/db/schema/admin";
import type {
  CreateReportInput,
  ListReportsQuery,
} from "@/server/validators/admin";

/* ── Types ─────────────────────────────────────────────────── */

export type { ModerationReport };

export type ModerationReportWithRelations = ModerationReport & {
  reporter: Pick<
    typeof users.$inferSelect,
    "id" | "email" | "firstName" | "lastName" | "avatarUrl"
  > | null;
  resolver: Pick<
    typeof users.$inferSelect,
    "id" | "email" | "firstName" | "lastName"
  > | null;
};

export type FlaggedContent = {
  contentId: string;
  title: string;
  type: string;
  reportsCount: number;
  lastReportedAt: Date;
};

export type FlaggedMessage = {
  messageId: string;
  body: string;
  reportsCount: number;
  lastReportedAt: Date;
};

export type PaginatedReports = {
  items: ModerationReportWithRelations[];
  total: number;
  page: number;
  pageSize: number;
};

export type ModerationAction = "approved" | "removed" | "warning";

/* ── Mutations ─────────────────────────────────────────────── */

export async function createReport(
  reporterId: string,
  input: CreateReportInput,
): Promise<ModerationReport> {
  const db = await getDb();
  const [row] = await db
    .insert(moderationReports)
    .values({
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      status: "open",
    })
    .returning();
  if (!row) throw AppError.internal("Failed to create report");
  return row;
}

export async function resolveReport(
  id: string,
  resolvedBy: string,
  action: ModerationAction,
): Promise<ModerationReport> {
  const db = await getDb();
  const [row] = await db
    .update(moderationReports)
    .set({
      status: "resolved",
      resolvedBy,
      updatedAt: new Date(),
    })
    .where(eq(moderationReports.id, id))
    .returning();
  if (!row) throw AppError.notFound("Report not found");

  // Side-effect: if action is "removed", archive the target content/message.
  if (action === "removed") {
    if (row.targetType === "content") {
      await db
        .update(contents)
        .set({ visibility: "archived", updatedAt: new Date() })
        .where(eq(contents.id, row.targetId));
    } else if (row.targetType === "message") {
      await db.delete(messages).where(eq(messages.id, row.targetId));
    }
  }

  return row;
}

export async function dismissReport(
  id: string,
  resolvedBy: string,
): Promise<ModerationReport> {
  const db = await getDb();
  const [row] = await db
    .update(moderationReports)
    .set({
      status: "dismissed",
      resolvedBy,
      updatedAt: new Date(),
    })
    .where(eq(moderationReports.id, id))
    .returning();
  if (!row) throw AppError.notFound("Report not found");
  return row;
}

/**
 * Remove (archive) a content as a moderator action. Logs are written by the
 * server action wrapping this call (via audit service).
 */
export async function removeContent(
  contentId: string,
  _moderatorId: string,
): Promise<void> {
  const db = await getDb();
  const [updated] = await db
    .update(contents)
    .set({ visibility: "archived", updatedAt: new Date() })
    .where(eq(contents.id, contentId))
    .returning();
  if (!updated) throw AppError.notFound("Content not found");
}

/**
 * Hard-delete a message as a moderator action.
 */
export async function removeMessage(
  messageId: string,
  _moderatorId: string,
): Promise<void> {
  const db = await getDb();
  await db.delete(messages).where(eq(messages.id, messageId));
}

/* ── Queries ───────────────────────────────────────────────── */

export async function listReports(
  filters: ListReportsQuery,
): Promise<PaginatedReports> {
  const db = await getDb();
  const { page, pageSize, status, targetType } = filters;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(moderationReports.status, status));
  if (targetType) conditions.push(eq(moderationReports.targetType, targetType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        report: moderationReports,
        reporter: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(moderationReports)
      .leftJoin(users, eq(users.id, moderationReports.reporterId))
      .where(where)
      .orderBy(desc(moderationReports.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ c: count() }).from(moderationReports).where(where),
  ]);

  // We separately fetch resolver info (one extra small query).
  const resolvedByIds = Array.from(
    new Set(
      rows
        .map((r) => r.report.resolvedBy)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const resolvers = resolvedByIds.length
    ? await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(inArray(users.id, resolvedByIds))
    : [];
  const resolverMap = new Map(resolvers.map((r) => [r.id, r]));

  const items: ModerationReportWithRelations[] = rows.map((r) => ({
    ...r.report,
    reporter: r.reporter ?? null,
    resolver: r.report.resolvedBy
      ? (resolverMap.get(r.report.resolvedBy) ?? null)
      : null,
  }));

  return {
    items,
    total: Number(totalRows.at(0)?.c ?? 0),
    page,
    pageSize,
  };
}

export async function getReport(
  id: string,
): Promise<ModerationReportWithRelations> {
  const db = await getDb();
  const rows = await db
    .select({
      report: moderationReports,
      reporter: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(moderationReports)
    .leftJoin(users, eq(users.id, moderationReports.reporterId))
    .where(eq(moderationReports.id, id))
    .limit(1);
  const row = rows.at(0);
  if (!row) throw AppError.notFound("Report not found");

  let resolver: ModerationReportWithRelations["resolver"] = null;
  if (row.report.resolvedBy) {
    const rRows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, row.report.resolvedBy))
      .limit(1);
    resolver = rRows.at(0) ?? null;
  }

  return { ...row.report, reporter: row.reporter ?? null, resolver };
}

/**
 * Contents that have at least one open/in_review report — for the moderation
 * queue quick-glance.
 */
export async function listFlaggedContents(
  limit = 20,
): Promise<FlaggedContent[]> {
  const db = await getDb();
  const rows = await db
    .select({
      contentId: moderationReports.targetId,
      title: contents.title,
      type: contents.type,
      reportsCount: count(),
      lastReportedAt: moderationReports.createdAt,
    })
    .from(moderationReports)
    .innerJoin(contents, eq(contents.id, moderationReports.targetId))
    .where(
      and(
        eq(moderationReports.targetType, "content"),
        inArray(moderationReports.status, ["open", "in_review"]),
      ),
    )
    .groupBy(moderationReports.targetId, contents.title, contents.type)
    .orderBy(desc(moderationReports.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    contentId: r.contentId,
    title: r.title,
    type: r.type,
    reportsCount: Number(r.reportsCount),
    lastReportedAt: r.lastReportedAt,
  }));
}

/**
 * Messages that have at least one open/in_review report.
 */
export async function listFlaggedMessages(
  limit = 20,
): Promise<FlaggedMessage[]> {
  const db = await getDb();
  const rows = await db
    .select({
      messageId: moderationReports.targetId,
      body: messages.body,
      reportsCount: count(),
      lastReportedAt: moderationReports.createdAt,
    })
    .from(moderationReports)
    .innerJoin(messages, eq(messages.id, moderationReports.targetId))
    .where(
      and(
        eq(moderationReports.targetType, "message"),
        inArray(moderationReports.status, ["open", "in_review"]),
      ),
    )
    .groupBy(moderationReports.targetId, messages.body)
    .orderBy(desc(moderationReports.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    messageId: r.messageId,
    body: r.body,
    reportsCount: Number(r.reportsCount),
    lastReportedAt: r.lastReportedAt,
  }));
}

/**
 * Returns total count of pending (open + in_review) reports — used for the
 * moderation-queue badge.
 */
export async function getPendingReportsCount(): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(moderationReports)
    .where(inArray(moderationReports.status, ["open", "in_review"]));
  return Number(rows.at(0)?.c ?? 0);
}
