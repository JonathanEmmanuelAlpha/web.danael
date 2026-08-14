"use server";

/**
 * §5.14 — Parent server actions.
 *
 * Wraps the parent service with auth + RBAC + Zod validation. Each action
 * returns a typed ApiResponse<T>.
 *
 * Authorization rules:
 *  - Only users with role `parent` (or `platform_admin` for oversight) can
 *    manage parent↔child links.
 *  - Parent can only fetch data for children they are linked to (verified
 *    via `isParentOf`).
 */

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isParentOf, requireRole } from "@/server/permissions";
import * as parentService from "@/server/services/parent";
import {
  childTimelineQuerySchema,
  linkChildSchema,
  unlinkChildSchema,
} from "@/server/validators/parent";
import type {
  ChildAttendanceSummary,
  ChildAssignmentsSummary,
  ChildGradesSummary,
  ChildOverview,
  ChildSummary,
  ChildTimelineItem,
  ParentStudentRelation,
} from "@/server/services/parent";

/* ── Helpers ───────────────────────────────────────────────── */

async function requireParent(): Promise<{ userId: string }> {
  await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    throw AppError.notFound("User profile not found. Please complete onboarding.");
  }
  requireRole(dbUser.role, "parent", "platform_admin");
  return { userId: dbUser.id };
}

async function requireParentOf(
  studentId: string,
): Promise<{ userId: string }> {
  const { userId } = await requireParent();
  const linked = await isParentOf(userId, studentId);
  if (!linked) {
    throw AppError.forbidden("Vous n'êtes pas lié à cet élève");
  }
  return { userId };
}

function handleErr(err: unknown, label: string): ApiResponse<never> {
  if (err instanceof AppError) {
    return { success: false, error: { code: err.code, message: err.message } };
  }
  logger.error(`${label} failed`, { error: String(err) });
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Erreur inattendue" },
  };
}

/* ── Mutations ─────────────────────────────────────────────── */

export async function linkChildAction(
  input: z.input<typeof linkChildSchema>,
): Promise<ApiResponse<ParentStudentRelation>> {
  try {
    const { userId } = await requireParent();
    const parsed = linkChildSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const relation = await parentService.linkChild(userId, parsed.data);
    logger.info("Parent linked child", {
      parentId: userId,
      studentId: relation.studentId,
    });
    revalidatePath("/children");
    revalidatePath("/dashboard");
    return { success: true, data: relation };
  } catch (err) {
    return handleErr(err, "linkChildAction");
  }
}

export async function unlinkChildAction(
  input: z.input<typeof unlinkChildSchema>,
): Promise<ApiResponse<{ removed: boolean }>> {
  try {
    const { userId } = await requireParent();
    const parsed = unlinkChildSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    // Verify the parent owns this relation.
    const linked = await isParentOf(userId, parsed.data.studentId);
    if (!linked) {
      throw AppError.forbidden("Vous n'êtes pas lié à cet élève");
    }
    const result = await parentService.unlinkChild(
      userId,
      parsed.data.studentId,
    );
    logger.info("Parent unlinked child", {
      parentId: userId,
      studentId: parsed.data.studentId,
    });
    revalidatePath("/children");
    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (err) {
    return handleErr(err, "unlinkChildAction");
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function listChildrenAction(): Promise<ApiResponse<ChildSummary[]>> {
  try {
    const { userId } = await requireParent();
    const items = await parentService.listChildren(userId);
    return { success: true, data: items };
  } catch (err) {
    return handleErr(err, "listChildrenAction");
  }
}

export async function getChildOverviewAction(
  studentId: string,
): Promise<ApiResponse<ChildOverview>> {
  try {
    await requireParentOf(studentId);
    const overview = await parentService.getChildOverview(studentId);
    return { success: true, data: overview };
  } catch (err) {
    return handleErr(err, "getChildOverviewAction");
  }
}

export async function getChildGradesAction(
  studentId: string,
): Promise<ApiResponse<ChildGradesSummary>> {
  try {
    await requireParentOf(studentId);
    const data = await parentService.getChildGrades(studentId);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getChildGradesAction");
  }
}

export async function getChildAttendanceAction(
  studentId: string,
): Promise<ApiResponse<ChildAttendanceSummary>> {
  try {
    await requireParentOf(studentId);
    const data = await parentService.getChildAttendance(studentId);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getChildAttendanceAction");
  }
}

export async function getChildAssignmentsAction(
  studentId: string,
): Promise<ApiResponse<ChildAssignmentsSummary>> {
  try {
    await requireParentOf(studentId);
    const data = await parentService.getChildAssignments(studentId);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getChildAssignmentsAction");
  }
}

export async function getChildProgressTimelineAction(
  studentId: string,
  limit = 20,
): Promise<ApiResponse<ChildTimelineItem[]>> {
  try {
    await requireParentOf(studentId);
    const parsed = childTimelineQuerySchema.safeParse({ studentId, limit });
    if (!parsed.success) {
      throw AppError.validation("Entrée invalide", parsed.error.flatten());
    }
    const data = await parentService.getChildProgressTimeline(
      parsed.data.studentId,
      parsed.data.limit,
    );
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getChildProgressTimelineAction");
  }
}
