/**
 * §5.16 — Audit log service.
 *
 * Append-only audit trail of every privileged platform action (role change,
 * school verification, content removal, flag toggle, report resolution…).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 */

import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import { auditLogs, users } from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type { AuditLog } from "@/server/db/schema/admin";
import type { ListAuditLogsQuery } from "@/server/validators/admin";
import type { JsonRecord } from "@/server/db/schema/_env";

/* ── Types ─────────────────────────────────────────────────── */

export type { AuditLog };

export type AuditLogWithActor = AuditLog & {
  actor: Pick<
    typeof users.$inferSelect,
    "id" | "email" | "firstName" | "lastName" | "avatarUrl" | "role"
  > | null;
};

export type PaginatedAuditLogs = {
  items: AuditLogWithActor[];
  total: number;
  page: number;
  pageSize: number;
};

/* ── Mutations ─────────────────────────────────────────────── */

/**
 * Append a new audit log entry. Best-effort: errors are swallowed so the
 * caller's primary flow is never blocked by an audit write failure.
 */
export async function logAction(
  actorId: string | null | undefined,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: JsonRecord,
): Promise<AuditLog | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .insert(auditLogs)
      .values({
        actorId: actorId ?? null,
        action,
        entityType,
        entityId,
        metadata: (metadata as JsonRecord) ?? null,
      })
      .returning();
    return row ?? null;
  } catch {
    // Audit logs must NEVER break the calling flow.
    return null;
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function listAuditLogs(
  filters: ListAuditLogsQuery,
): Promise<PaginatedAuditLogs> {
  const db = await getDb();
  const { page, pageSize, actorId, action, entityType, from, to } = filters;

  const conditions: SQL[] = [];
  if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
  if (action) conditions.push(eq(auditLogs.action, action));
  if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
  if (from) conditions.push(gte(auditLogs.createdAt, new Date(from)));
  if (to) conditions.push(lte(auditLogs.createdAt, new Date(to)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        log: auditLogs,
        actor: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarUrl,
          role: users.role,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ c: count() }).from(auditLogs).where(where),
  ]);

  return {
    items: rows.map((r) => ({ ...r.log, actor: r.actor ?? null })),
    total: Number(totalRows.at(0)?.c ?? 0),
    page,
    pageSize,
  };
}

export async function getAuditLog(id: string): Promise<AuditLogWithActor> {
  const db = await getDb();
  const rows = await db
    .select({
      log: auditLogs,
      actor: {
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        role: users.role,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(eq(auditLogs.id, id))
    .limit(1);

  const row = rows.at(0);
  if (!row) {
    throw AppError.notFound("Audit log entry not found");
  }
  return { ...row.log, actor: row.actor ?? null };
}
