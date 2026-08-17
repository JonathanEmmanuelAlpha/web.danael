"use server";

/**
 * School access codes & access request server actions.
 *
 * Wraps the `school-access` service with auth + RBAC + Zod validation.
 * Each action returns a typed `ApiResponse<T>`.
 *
 * Auth model:
 *  - All actions require an authenticated session + DB user.
 *  - createAccessCode / listAccessCodes / listAccessRequests / approve / reject
 *    require the current user to be an active admin of their school
 *    (resolved via `getSchoolForAdminUser`).
 *  - joinSchoolManagementAction derives the school from the access code.
 */

import { revalidatePath } from "next/cache";
import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import * as accessService from "@/server/services/school-access";
import * as schoolsService from "@/server/services/schools";

/* ── Types ────────────────────────────────────────────────────── */

export interface AccessCodeListItem {
  id: string;
  accessCode: string;
  usages: number;
  maxUsages: number | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface AccessRequestListItem {
  id: string;
  schoolId: string;
  schoolAdminId: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  adminName: string;
  adminEmail: string;
  adminAvatarUrl: string | null;
  adminNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

/* ── Helpers ─────────────────────────────────────────────────── */

/**
 * Resolve the current user's school (where they are an admin).
 * Throws AppError.forbidden if the user is not a school admin of any school.
 */
async function requireMySchool(): Promise<{
  userId: string;
  schoolId: string;
  schoolName: string;
}> {
  await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    throw AppError.notFound("User profile not found");
  }
  if (dbUser.role !== "school_admin" && dbUser.role !== "platform_admin") {
    throw AppError.unauthorized(
      "Seul un administrateur d'établissement peut gérer les codes d'accès",
    );
  }

  const school = await schoolsService.getSchoolForAdminUser(dbUser.id);
  if (!school) {
    throw AppError.notFound(
      "Aucun établissement trouvé pour votre compte. Créez d'abord votre école.",
    );
  }

  return { userId: dbUser.id, schoolId: school.id, schoolName: school.name };
}

/* ── Mutations ───────────────────────────────────────────────── */

/**
 * Create an access code for the current user's school.
 * `maxUsages` null = unlimited. `expiresInSeconds` null = never.
 */
export async function createAccessCodeAction(input: {
  maxUsages?: number | null;
  expiresInSeconds?: number | null;
}): Promise<ApiResponse<{ id: string; accessCode: string }>> {
  try {
    const { userId, schoolId } = await requireMySchool();

    if (
      input.maxUsages !== undefined &&
      input.maxUsages !== null &&
      (typeof input.maxUsages !== "number" || input.maxUsages < 1)
    ) {
      throw AppError.validation("maxUsages must be a positive integer");
    }
    if (
      input.expiresInSeconds !== undefined &&
      input.expiresInSeconds !== null &&
      (typeof input.expiresInSeconds !== "number" || input.expiresInSeconds < 1)
    ) {
      throw AppError.validation("expiresInSeconds must be a positive integer");
    }

    const created = await accessService.createAccessCode({
      schoolId,
      createdBy: userId,
      maxUsages: input.maxUsages ?? null,
      expiresInSeconds: input.expiresInSeconds ?? null,
    });

    logger.info("Access code created (action)", {
      codeId: created.id,
      schoolId,
      byUserId: userId,
    });

    revalidatePath("/access-codes");
    return {
      success: true,
      data: { id: created.id, accessCode: created.accessCode },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("createAccessCodeAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de créer le code d'accès",
      },
    };
  }
}

/**
 * Join a school management (school_admin onboarding).
 * Derives the school from the access code; creates a pending access request.
 */
export async function joinSchoolManagementAction(input: {
  accessCode: string;
}): Promise<
  ApiResponse<{
    requestId: string;
    status: string;
    schoolId: string;
    schoolName?: string;
  }>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) {
      throw AppError.notFound("User profile not found");
    }

    const trimmed = input.accessCode?.trim().toUpperCase();
    if (!trimmed || trimmed.length < 6) {
      throw AppError.validation("Code d'accès invalide");
    }

    const result = await accessService.requestSchoolAdminAccess({
      schoolAdminId: dbUser.id,
      accessCode: trimmed,
    });

    logger.info("Join school management request (action)", {
      requestId: result.requestId,
      schoolAdminId: dbUser.id,
      clerkId: session.clerkId,
      status: result.status,
    });

    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("joinSchoolManagementAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'envoyer la demande",
      },
    };
  }
}

export async function getAccessRequestAction(
  requestId: string,
  schoolId: string,
): Promise<ApiResponse<{ requestId: string }>> {
  const request = await accessService.getAccessRequest(requestId, schoolId);

  if (!request || !request.id)
    throw AppError.validation("Demande d'accès non finalisée");

  return { success: true, data: { requestId: request.id } };
}

/**
 * Approve an access request — adds the requester as an admin member.
 */
export async function approveAccessRequestAction(input: {
  requestId: string;
}): Promise<ApiResponse<{ status: string; memberId: string }>> {
  try {
    const { userId } = await requireMySchool();

    const result = await accessService.approveAccessRequest({
      requestId: input.requestId,
      decidedBy: userId,
    });

    logger.info("Access request approved (action)", {
      requestId: input.requestId,
      decidedBy: userId,
      memberId: result.memberId,
    });

    revalidatePath("/access-requests");
    revalidatePath("/teachers");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("approveAccessRequestAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'approuver la demande",
      },
    };
  }
}

/**
 * Reject an access request.
 */
export async function rejectAccessRequestAction(input: {
  requestId: string;
  adminNote?: string;
}): Promise<ApiResponse<{ status: string }>> {
  try {
    const { userId } = await requireMySchool();

    const updated = await accessService.rejectAccessRequest({
      requestId: input.requestId,
      decidedBy: userId,
      adminNote: input.adminNote,
    });

    logger.info("Access request rejected (action)", {
      requestId: input.requestId,
      decidedBy: userId,
    });

    revalidatePath("/access-requests");
    return { success: true, data: { status: updated.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("rejectAccessRequestAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de rejeter la demande",
      },
    };
  }
}

/**
 * Deactivate an access code (revoke).
 */
export async function deactivateAccessCodeAction(input: {
  codeId: string;
}): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireMySchool();

    const updated = await accessService.deactivateAccessCode(input.codeId);
    logger.info("Access code deactivated (action)", { codeId: input.codeId });

    revalidatePath("/access-codes");
    return {
      success: true,
      data: { status: updated.isActive ? "active" : "inactive" },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("deactivateAccessCodeAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de désactiver le code",
      },
    };
  }
}

/* ── Queries ─────────────────────────────────────────────────── */

/**
 * List access codes for the current user's school.
 */
export async function listMyAccessCodesAction(): Promise<
  ApiResponse<AccessCodeListItem[]>
> {
  try {
    const { schoolId } = await requireMySchool();
    const codes = await accessService.listAccessCodes(schoolId);
    return {
      success: true,
      data: codes.map((c) => ({
        id: c.id,
        accessCode: c.accessCode,
        usages: c.usages,
        maxUsages: c.maxUsages,
        expiresAt: c.expiresAt,
        isActive: c.isActive,
        createdAt: c.createdAt,
      })),
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listMyAccessCodesAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les codes d'accès",
      },
    };
  }
}

/**
 * List access requests for the current user's school.
 */
export async function listAccessRequestsAction(input?: {
  status?: "pending" | "approved" | "rejected" | "cancelled";
}): Promise<ApiResponse<AccessRequestListItem[]>> {
  try {
    const { schoolId } = await requireMySchool();
    const requests = await accessService.listAccessRequests({
      schoolId,
      status: input?.status,
    });
    return {
      success: true,
      data: requests.map((r) => ({
        id: r.id,
        schoolId: r.schoolId,
        schoolAdminId: r.schoolAdminId,
        status: r.status,
        adminName: r.adminName,
        adminEmail: r.adminEmail,
        adminAvatarUrl: r.adminAvatarUrl,
        adminNote: r.adminNote,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
      })),
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listAccessRequestsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les demandes d'accès",
      },
    };
  }
}
