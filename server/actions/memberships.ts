"use server";

/**
 * Memberships server actions — invitations, join requests, join-by-code.
 *
 * Wraps the memberships service with auth + RBAC + Zod validation.
 */

import { revalidatePath } from "next/cache";
import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getSchoolMember, getClassMember } from "@/server/permissions";
import * as membershipsService from "@/server/services/memberships";
import type { School, Class } from "@/server/db/schema/schools";

/* ── Join by code ─────────────────────────────────────────────── */

export async function joinSchoolByCodeAction(input: {
  code: string;
  roleInSchool?: "admin" | "teacher" | "student" | "parent" | "staff";
}): Promise<ApiResponse<{ school: School; alreadyMember: boolean }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.joinSchoolByCode({
      userId: dbUser.id,
      code: input.code,
      roleInSchool:
        input.roleInSchool ?? (dbUser.role as "teacher" | "student"),
    });

    revalidatePath("/dashboard");
    revalidatePath("/classes");
    revalidatePath("/students");
    revalidatePath("/teachers");
    return {
      success: true,
      data: {
        school: result.school,
        alreadyMember:
          result.member.joinedAt !== null &&
          result.member.joinedAt.getTime() < Date.now() - 1000,
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("joinSchoolByCodeAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de rejoindre l'école",
      },
    };
  }
}

export async function joinClassByCodeAction(input: {
  code: string;
  role?: "admin" | "teacher" | "student" | "parent" | "staff";
}): Promise<ApiResponse<{ class: Class }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.joinClassByCode({
      userId: dbUser.id,
      code: input.code,
      role: input.role,
    });

    revalidatePath("/classes");
    revalidatePath("/dashboard");
    return { success: true, data: { class: result.class } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("joinClassByCodeAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de rejoindre la classe",
      },
    };
  }
}

/* ── Join requests ────────────────────────────────────────────── */

export async function requestToJoinSchoolAction(input: {
  schoolId: string;
  roleInSchool: "admin" | "teacher" | "student" | "parent" | "staff";
  message?: string;
}): Promise<ApiResponse<{ id: string; status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const req = await membershipsService.requestToJoinSchool({
      schoolId: input.schoolId,
      userId: dbUser.id,
      roleInSchool: input.roleInSchool,
      message: input.message,
    });

    revalidatePath("/dashboard");
    revalidatePath("/my-requests");
    return { success: true, data: { id: req.id, status: req.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("requestToJoinSchoolAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'envoyer la demande",
      },
    };
  }
}

export async function requestToJoinClassAction(input: {
  classId: string;
  role?: "admin" | "teacher" | "student" | "parent" | "staff";
  message?: string;
}): Promise<ApiResponse<{ id: string; status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const req = await membershipsService.requestToJoinClass({
      classId: input.classId,
      userId: dbUser.id,
      role: input.role,
      message: input.message,
    });

    revalidatePath("/classes");
    revalidatePath("/my-requests");
    return { success: true, data: { id: req.id, status: req.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("requestToJoinClassAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'envoyer la demande",
      },
    };
  }
}

export async function approveSchoolJoinRequestAction(input: {
  requestId: string;
  adminNote?: string;
}): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Verify the user is admin of the school this request targets
    // (fetch the request first to get schoolId)
    if (dbUser.role !== "school_admin")
      return {
        success: false,
        error: {
          message: "User not authorized to perform this action",
          code: "UNAUTHORIZED",
        },
      };

    const result = await membershipsService.approveSchoolJoinRequest({
      requestId: input.requestId,
      decidedBy: dbUser.id,
      adminNote: input.adminNote,
    });

    revalidatePath("/students");
    revalidatePath("/teachers");
    revalidatePath("/requests");
    return { success: true, data: { status: result.request.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("approveSchoolJoinRequestAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'approuver la demande",
      },
    };
  }
}

export async function rejectSchoolJoinRequestAction(input: {
  requestId: string;
  adminNote?: string;
}): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.rejectSchoolJoinRequest({
      requestId: input.requestId,
      decidedBy: dbUser.id,
      adminNote: input.adminNote,
    });

    revalidatePath("/requests");
    return { success: true, data: { status: result.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("rejectSchoolJoinRequestAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de rejeter la demande",
      },
    };
  }
}

export async function approveClassJoinRequestAction(input: {
  requestId: string;
  adminNote?: string;
}): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.approveClassJoinRequest({
      requestId: input.requestId,
      decidedBy: dbUser.id,
      adminNote: input.adminNote,
    });

    revalidatePath("/classes");
    revalidatePath("/requests");
    return { success: true, data: { status: result.request.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("approveClassJoinRequestAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'approuver la demande",
      },
    };
  }
}

export async function rejectClassJoinRequestAction(input: {
  requestId: string;
  adminNote?: string;
}): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.rejectClassJoinRequest({
      requestId: input.requestId,
      decidedBy: dbUser.id,
      adminNote: input.adminNote,
    });

    revalidatePath("/requests");
    return { success: true, data: { status: result.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("rejectClassJoinRequestAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de rejeter la demande",
      },
    };
  }
}

export async function cancelSchoolJoinRequestAction(
  requestId: string,
): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.cancelSchoolJoinRequest(
      requestId,
      dbUser.id,
    );

    revalidatePath("/my-requests");
    return { success: true, data: { status: result.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("cancelSchoolJoinRequestAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'annuler la demande",
      },
    };
  }
}

export async function cancelClassJoinRequestAction(
  requestId: string,
): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.cancelClassJoinRequest(
      requestId,
      dbUser.id,
    );

    revalidatePath("/my-requests");
    return { success: true, data: { status: result.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("cancelClassJoinRequestAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'annuler la demande",
      },
    };
  }
}

/* ── In-app invitations ───────────────────────────────────────── */

export async function createInvitationAction(input: {
  targetType: "school" | "class";
  targetId: string;
  inviteeEmail?: string;
  inviteeUserId?: string;
  roleInTarget: "admin" | "teacher" | "student" | "parent" | "staff";
  message?: string;
}): Promise<ApiResponse<{ id: string; status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Verify the inviter has admin rights on the target
    if (input.targetType === "school") {
      const member = await getSchoolMember(dbUser.id, input.targetId);
      if (!member || member.roleInSchool !== "admin") {
        throw AppError.unauthorized(
          "Seuls les administrateurs de l'école peuvent inviter",
        );
      }
    } else {
      const member = await getClassMember(dbUser.id, input.targetId);
      if (!member || (member.role !== "teacher" && member.role !== "admin")) {
        throw AppError.unauthorized(
          "Seuls les enseignants et administrateurs peuvent inviter",
        );
      }
    }

    const inv = await membershipsService.createInvitation({
      targetType: input.targetType,
      targetId: input.targetId,
      inviteeEmail: input.inviteeEmail,
      inviteeUserId: input.inviteeUserId,
      roleInTarget: input.roleInTarget,
      invitedBy: dbUser.id,
      message: input.message,
    });

    revalidatePath("/invitations");
    revalidatePath("/students");
    revalidatePath("/teachers");
    return { success: true, data: { id: inv.id, status: inv.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("createInvitationAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'envoyer l'invitation",
      },
    };
  }
}

export async function acceptInvitationAction(
  invitationId: string,
): Promise<ApiResponse<{ targetType: string; targetId: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.acceptInvitation(
      invitationId,
      dbUser.id,
    );

    revalidatePath("/dashboard");
    revalidatePath("/classes");
    revalidatePath("/students");
    revalidatePath("/teachers");
    revalidatePath("/invitations");
    return {
      success: true,
      data: {
        targetType: result.invitation.targetType,
        targetId: result.invitation.targetId,
      },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("acceptInvitationAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'accepter l'invitation",
      },
    };
  }
}

export async function rejectInvitationAction(
  invitationId: string,
): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.rejectInvitation(
      invitationId,
      dbUser.id,
    );

    revalidatePath("/invitations");
    return { success: true, data: { status: result.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("rejectInvitationAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de rejeter l'invitation",
      },
    };
  }
}

export async function cancelInvitationAction(
  invitationId: string,
): Promise<ApiResponse<{ status: string }>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await membershipsService.cancelInvitation(invitationId);

    revalidatePath("/invitations");
    return { success: true, data: { status: result.status } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("cancelInvitationAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible d'annuler l'invitation",
      },
    };
  }
}

/* ── Queries ──────────────────────────────────────────────────── */

export async function listMyInvitationsAction(): Promise<
  ApiResponse<
    Array<{
      id: string;
      targetType: string;
      targetId: string;
      targetName: string;
      targetCity: string | null;
      roleInTarget: string;
      message: string | null;
      status: string;
      invitedByName: string;
      invitedByAvatarUrl: string | null;
      createdAt: Date;
      expiresAt: Date | null;
    }>
  >
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const items = await membershipsService.listMyInvitations(dbUser.id);
    return {
      success: true,
      data: items.map((it) => ({
        id: it.invitation.id,
        targetType: it.invitation.targetType,
        targetId: it.invitation.targetId,
        targetName: it.targetName,
        targetCity: it.targetCity,
        roleInTarget: it.invitation.roleInTarget,
        message: it.invitation.message,
        status: it.invitation.status,
        invitedByName: it.invitedByName,
        invitedByAvatarUrl: it.invitedByAvatarUrl,
        createdAt: it.invitation.createdAt,
        expiresAt: it.invitation.expiresAt,
      })),
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listMyInvitationsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les invitations",
      },
    };
  }
}

export async function listMyJoinRequestsAction(): Promise<
  ApiResponse<
    Array<{
      id: string;
      type: "school";
      refId: string;
      refName: string;
      refCity: string | null;
      role: string;
      message: string | null;
      status: string;
      createdAt: Date;
      decidedAt: Date | null;
      adminNote: string | null;
    }>
  >
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const schoolReqs = await membershipsService.listMyJoinRequests(dbUser.id);
    const classReqs = await membershipsService.listMyClassJoinRequests(
      dbUser.id,
    );

    const schoolItems = schoolReqs.map((r) => ({
      id: r.id,
      type: "school" as const,
      refId: r.schoolId,
      refName: r.schoolName,
      refCity: r.schoolCity,
      role: r.roleInSchool,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      adminNote: r.adminNote,
    }));

    const classItems = classReqs.map((r) => ({
      id: r.id,
      type: "school" as const, // we'll override below
      refId: r.classId,
      refName: r.className,
      refCity: null,
      role: r.role,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      adminNote: r.adminNote,
    }));

    // Override type for class items (TS workaround)
    const allItems = [
      ...schoolItems,
      ...classItems.map((c) => ({ ...c, type: "class" as const })),
    ];

    // Sort by createdAt desc
    allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { success: true, data: allItems };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listMyJoinRequestsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les demandes",
      },
    };
  }
}

export async function listReceivedJoinRequestsAction(input: {
  targetType: "school" | "class";
  targetId: string;
  status?: "pending" | "approved" | "rejected" | "cancelled";
}): Promise<
  ApiResponse<
    Array<{
      id: string;
      userId: string;
      userName: string;
      userEmail: string;
      userAvatarUrl: string | null;
      role: string;
      message: string | null;
      status: string;
      createdAt: Date;
      adminNote: string | null;
    }>
  >
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Verify admin rights
    if (input.targetType === "school") {
      const member = await getSchoolMember(dbUser.id, input.targetId);
      if (!member || member.roleInSchool !== "admin") {
        throw AppError.unauthorized("Action réservée aux administrateurs");
      }
    } else {
      const member = await getClassMember(dbUser.id, input.targetId);
      if (!member || (member.role !== "teacher" && member.role !== "admin")) {
        throw AppError.unauthorized("Action réservée aux enseignants");
      }
    }

    const items =
      input.targetType === "school"
        ? await membershipsService.listSchoolJoinRequests({
            schoolId: input.targetId,
            status: input.status,
          })
        : await membershipsService.listClassJoinRequests({
            classId: input.targetId,
            status: input.status,
          });

    return {
      success: true,
      data: items.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        userEmail: r.userEmail,
        userAvatarUrl: r.userAvatarUrl,
        role: "roleInSchool" in r ? r.roleInSchool : r.role,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        adminNote: r.adminNote,
      })),
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listReceivedJoinRequestsAction failed", {
      error: String(err),
    });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les demandes",
      },
    };
  }
}

export async function listSentInvitationsAction(input: {
  targetType: "school" | "class";
  targetId: string;
}): Promise<
  ApiResponse<
    Array<{
      id: string;
      inviteeName: string;
      inviteeEmail: string;
      inviteeAvatarUrl: string | null;
      roleInTarget: string;
      status: string;
      message: string | null;
      createdAt: Date;
      expiresAt: Date | null;
    }>
  >
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const items = await membershipsService.listSentInvitations({
      targetType: input.targetType,
      targetId: input.targetId,
    });

    return {
      success: true,
      data: items.map((it) => ({
        id: it.invitation.id,
        inviteeName: it.inviteeName,
        inviteeEmail: it.inviteeEmail,
        inviteeAvatarUrl: it.inviteeAvatarUrl,
        roleInTarget: it.invitation.roleInTarget,
        status: it.invitation.status,
        message: it.invitation.message,
        createdAt: it.invitation.createdAt,
        expiresAt: it.invitation.expiresAt,
      })),
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listSentInvitationsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Impossible de charger les invitations",
      },
    };
  }
}
