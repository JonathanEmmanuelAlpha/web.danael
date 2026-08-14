"use server";

/**
 * §5.16 — Admin server actions.
 *
 * Wraps the admin service with auth + RBAC (platform_admin for most actions)
 * + Zod validation. Each action returns a typed ApiResponse<T>.
 *
 * Every sensitive mutation also writes an audit log entry (role change,
 * deactivation, school verification, content removal).
 */

import { revalidatePath } from "next/cache";

import { requireDbUser } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireRole } from "@/server/permissions";

import * as adminService from "@/server/services/admin";
import { logAction } from "@/server/services/audit";
import { removeContent as moderationRemoveContent } from "@/server/services/moderation";
import {
  listUsersQuerySchema,
  getUserByIdSchema,
  updateUserRoleSchema,
  deactivateUserSchema,
  listAdminSchoolsQuerySchema,
  verifySchoolSchema,
  listContentsAdminQuerySchema,
  removeContentSchema,
  listAdminSubscriptionsQuerySchema,
  listAdminPaymentsQuerySchema,
} from "@/server/validators/admin";
import type {
  AdminUserRow,
  AdminUserDetail,
  AdminSchoolRow,
  AdminContentRow,
  Subscription,
  Payment,
  Paginated,
  PlatformStats,
} from "@/server/services/admin";

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

/* ── Users ─────────────────────────────────────────────────── */

export async function listUsersAction(
  input: unknown,
): Promise<ApiResponse<Paginated<AdminUserRow>>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "support");

    const parsed = listUsersQuerySchema.parse(input);
    const result = await adminService.listUsers(parsed);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listUsersAction");
  }
}

export async function getUserByIdAction(
  input: unknown,
): Promise<ApiResponse<AdminUserDetail>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "support");

    const parsed = getUserByIdSchema.parse(input);
    const detail = await adminService.getUserById(parsed.id);
    return { success: true, data: detail };
  } catch (err) {
    return handleErr(err, "getUserByIdAction");
  }
}

export async function updateUserRoleAction(
  input: unknown,
): Promise<ApiResponse<{ id: string; role: string }>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");

    const parsed = updateUserRoleSchema.parse(input);
    const updated = await adminService.updateUserRole(parsed.userId, parsed.role);

    await logAction(
      user.id,
      "user.role.change",
      "user",
      parsed.userId,
      { previousRole: user.role, newRole: parsed.role },
    );
    revalidatePath("/admin/users");
    return { success: true, data: { id: updated.id, role: updated.role } };
  } catch (err) {
    return handleErr(err, "updateUserRoleAction");
  }
}

export async function deactivateUserAction(
  input: unknown,
): Promise<ApiResponse<{ id: string; deactivated: true }>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");

    const parsed = deactivateUserSchema.parse(input);
    if (parsed.userId === user.id) {
      throw AppError.validation("You cannot deactivate your own account");
    }
    const updated = await adminService.deactivateUser(parsed.userId);

    await logAction(
      user.id,
      "user.deactivate",
      "user",
      updated.id,
      { newRole: "support" },
    );
    revalidatePath("/admin/users");
    return { success: true, data: { id: updated.id, deactivated: true } };
  } catch (err) {
    return handleErr(err, "deactivateUserAction");
  }
}

/* ── Schools ────────────────────────────────────────────────── */

export async function listAdminSchoolsAction(
  input: unknown,
): Promise<ApiResponse<Paginated<AdminSchoolRow>>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "support");

    const parsed = listAdminSchoolsQuerySchema.parse(input);
    const result = await adminService.listSchools(parsed);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listAdminSchoolsAction");
  }
}

export async function verifySchoolAction(
  input: unknown,
): Promise<ApiResponse<{ id: string; isVerified: boolean }>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin");

    const parsed = verifySchoolSchema.parse(input);
    const updated = await adminService.verifySchool(
      parsed.schoolId,
      parsed.verified,
    );

    await logAction(
      user.id,
      parsed.verified ? "school.verify" : "school.unverify",
      "school",
      parsed.schoolId,
      { verified: parsed.verified },
    );
    revalidatePath("/admin/schools");
    return { success: true, data: { id: updated.id, isVerified: updated.isVerified } };
  } catch (err) {
    return handleErr(err, "verifySchoolAction");
  }
}

/* ── Contents ──────────────────────────────────────────────── */

export async function listContentsAdminAction(
  input: unknown,
): Promise<ApiResponse<Paginated<AdminContentRow>>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");

    const parsed = listContentsAdminQuerySchema.parse(input);
    const result = await adminService.listContents(parsed);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listContentsAdminAction");
  }
}

export async function removeContentAction(
  input: unknown,
): Promise<ApiResponse<{ id: string; archived: true }>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "content_moderator");

    const parsed = removeContentSchema.parse(input);
    await moderationRemoveContent(parsed.contentId, user.id);

    await logAction(
      user.id,
      "content.remove",
      "content",
      parsed.contentId,
      { visibility: "archived" },
    );
    revalidatePath("/admin/contents");
    return { success: true, data: { id: parsed.contentId, archived: true } };
  } catch (err) {
    return handleErr(err, "removeContentAction");
  }
}

/* ── Subscriptions / Payments ──────────────────────────────── */

export async function listAdminSubscriptionsAction(
  input: unknown,
): Promise<ApiResponse<Paginated<Subscription>>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "support");

    const parsed = listAdminSubscriptionsQuerySchema.parse(input);
    const result = await adminService.listSubscriptions(parsed);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listAdminSubscriptionsAction");
  }
}

export async function listAdminPaymentsAction(
  input: unknown,
): Promise<ApiResponse<Paginated<Payment>>> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "support");

    const parsed = listAdminPaymentsQuerySchema.parse(input);
    const result = await adminService.listPayments(parsed);
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "listAdminPaymentsAction");
  }
}

/* ── Platform stats ────────────────────────────────────────── */

export async function getPlatformStatsAction(): Promise<
  ApiResponse<PlatformStats>
> {
  try {
    const user = await requireDbUser();
    requireRole(user.role, "platform_admin", "support", "content_moderator");

    const stats = await adminService.getPlatformStats();
    return { success: true, data: stats };
  } catch (err) {
    return handleErr(err, "getPlatformStatsAction");
  }
}
