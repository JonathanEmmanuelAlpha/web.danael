"use server";

/**
 * §5.16 — Audit log server actions.
 *
 * Wraps the audit service with auth + RBAC (platform_admin only).
 */

import { requireDbUser } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireRole } from "@/server/permissions";

import * as auditService from "@/server/services/audit";
import {
  listAuditLogsQuerySchema,
  getAuditLogSchema,
} from "@/server/validators/admin";
import type {
  AuditLog,
  AuditLogWithActor,
  PaginatedAuditLogs,
} from "@/server/services/audit";
import type { JsonRecord } from "@/server/db/schema/_env";

/* ── Helpers ─────────────────────────────────────────────── */

function handleErr(err: unknown, label: string): ApiResponse<never> {
  if (err instanceof AppError) {
    return { success: false, error: { code: err.code, message: err.message } };
  }
  logger.error(`${label} failed`, { error: String(err) });
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  };
}

/* ── Mutations ─────────────────────────────────────────────── */

/**
 * Direct audit log write — exposed for advanced use cases only. Most flows
 * should rely on the audit logs emitted automatically by other actions.
 */
export async function logActionAction(
  action: string,
  entityType: string,
  entityId: string,
  metadata?: JsonRecord,
): Promise<ApiResponse<AuditLog | null>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");
    const log = await auditService.logAction(
      user.id,
      action,
      entityType,
      entityId,
      metadata,
    );
    return { success: true, data: log };
  } catch (err) {
    return handleErr(err, "logActionAction");
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function listAuditLogsAction(
  input: unknown,
): Promise<ApiResponse<PaginatedAuditLogs>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");
    const parsed = listAuditLogsQuerySchema.parse(input);
    const result = await auditService.listAuditLogs(parsed);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listAuditLogsAction");
  }
}

export async function getAuditLogAction(
  input: unknown,
): Promise<ApiResponse<AuditLogWithActor>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");
    const parsed = getAuditLogSchema.parse(input);
    const log = await auditService.getAuditLog(parsed.id);
    return { success: true, data: log };
  } catch (err) {
    return handleErr(err, "getAuditLogAction");
  }
}
