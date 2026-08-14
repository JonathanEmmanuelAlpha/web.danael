"use server";

/**
 * §5.16 — Moderation server actions.
 *
 * Wraps the moderation service with auth + RBAC (platform_admin OR
 * content_moderator for most actions) + Zod validation.
 *
 * Sensitive mutations (resolve / dismiss / remove message) also write audit
 * log entries.
 */

import { revalidatePath } from "next/cache";

import { requireDbUser } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireRole } from "@/server/permissions";

import * as moderationService from "@/server/services/moderation";
import { logAction } from "@/server/services/audit";
import {
  createReportSchema,
  listReportsQuerySchema,
  getReportSchema,
  resolveReportSchema,
  dismissReportSchema,
  removeMessageSchema,
} from "@/server/validators/admin";
import type {
  ModerationReport,
  ModerationReportWithRelations,
  FlaggedContent,
  FlaggedMessage,
  PaginatedReports,
} from "@/server/services/moderation";

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
 * Any authenticated user can report something. The reporter is the current
 * user (cannot spoof).
 */
export async function createReportAction(
  input: unknown,
): Promise<ApiResponse<ModerationReport>> {
  try {
    const user = await requireDbUser();
    const parsed = createReportSchema.parse(input);
    const report = await moderationService.createReport(user.id, parsed);
    return { success: true, data: report };
  } catch (err) {
    return handleErr(err, "createReportAction");
  }
}

export async function resolveReportAction(
  input: unknown,
): Promise<ApiResponse<{ id: string; status: string; action: string }>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");

    const parsed = resolveReportSchema.parse(input);
    const report = await moderationService.resolveReport(
      parsed.id,
      user.id,
      parsed.action,
    );

    await logAction(
      user.id,
      "moderation.resolve",
      "report",
      parsed.id,
      { action: parsed.action, targetType: report.targetType, targetId: report.targetId },
    );
    revalidatePath("/admin/moderation");
    return {
      success: true,
      data: {
        id: report.id,
        status: report.status,
        action: parsed.action,
      },
    };
  } catch (err) {
    return handleErr(err, "resolveReportAction");
  }
}

export async function dismissReportAction(
  input: unknown,
): Promise<ApiResponse<{ id: string; status: string }>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");

    const parsed = dismissReportSchema.parse(input);
    const report = await moderationService.dismissReport(parsed.id, user.id);

    await logAction(
      user.id,
      "moderation.dismiss",
      "report",
      parsed.id,
      { targetType: report.targetType, targetId: report.targetId },
    );
    revalidatePath("/admin/moderation");
    return { success: true, data: { id: report.id, status: report.status } };
  } catch (err) {
    return handleErr(err, "dismissReportAction");
  }
}

export async function removeMessageAction(
  input: unknown,
): Promise<ApiResponse<{ id: string; removed: true }>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");

    const parsed = removeMessageSchema.parse(input);
    await moderationService.removeMessage(parsed.messageId, user.id);

    await logAction(user.id, "message.remove", "message", parsed.messageId);
    revalidatePath("/admin/moderation");
    return { success: true, data: { id: parsed.messageId, removed: true } };
  } catch (err) {
    return handleErr(err, "removeMessageAction");
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function listReportsAction(
  input: unknown,
): Promise<ApiResponse<PaginatedReports>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");

    const parsed = listReportsQuerySchema.parse(input);
    const result = await moderationService.listReports(parsed);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listReportsAction");
  }
}

export async function getReportAction(
  input: unknown,
): Promise<ApiResponse<ModerationReportWithRelations>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");

    const parsed = getReportSchema.parse(input);
    const report = await moderationService.getReport(parsed.id);
    return { success: true, data: report };
  } catch (err) {
    return handleErr(err, "getReportAction");
  }
}

export async function listFlaggedContentsAction(): Promise<
  ApiResponse<FlaggedContent[]>
> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");
    const items = await moderationService.listFlaggedContents(20);
    return { success: true, data: items };
  } catch (err) {
    return handleErr(err, "listFlaggedContentsAction");
  }
}

export async function listFlaggedMessagesAction(): Promise<
  ApiResponse<FlaggedMessage[]>
> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");
    const items = await moderationService.listFlaggedMessages(20);
    return { success: true, data: items };
  } catch (err) {
    return handleErr(err, "listFlaggedMessagesAction");
  }
}

export async function getPendingReportsCountAction(): Promise<
  ApiResponse<number>
> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");
    const count = await moderationService.getPendingReportsCount();
    return { success: true, data: count };
  } catch (err) {
    return handleErr(err, "getPendingReportsCountAction");
  }
}
