"use server";

/**
 * §5.3 — School server actions.
 *
 * Wraps the schools service with auth + RBAC + Zod validation. Each action
 * returns a typed ApiResponse<T>.
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isSchoolMember } from "@/server/permissions";
import {
  createSchoolSchema,
  updateSchoolSchema,
  listSchoolsQuerySchema,
  inviteByEmailSchema,
  type CreateSchoolInput,
  type UpdateSchoolInput,
  type ListSchoolsQuery,
} from "@/server/validators/schools";
import * as schoolsService from "@/server/services/schools";
import type {
  School,
  SchoolWithCounts,
  SchoolMemberWithUser,
  SchoolCardData,
  ClassCardData,
} from "@/server/services/schools";
import { SCHOOL_TYPE_VALUES } from "@/server/db/schema/enums";

/* ── Helpers ───────────────────────────────────────────────── */

async function requireSchoolAdmin(
  schoolId: string,
): Promise<{ userId: string; school: School }> {
  const session = await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");

  const member = await schoolsService.getMember(schoolId, dbUser.id);
  if (!member) {
    throw AppError.forbidden("You are not a member of this school");
  }
  if (member.roleInSchool !== "admin") {
    throw AppError.unauthorized("Only school admins can perform this action");
  }

  const school = await schoolsService.getSchoolById(schoolId).catch(() => null);
  if (!school) throw AppError.notFound("School not found");

  return { userId: dbUser.id, school };
}

/* ── Mutations ─────────────────────────────────────────────── */

export async function createSchoolAction(
  input: CreateSchoolInput,
): Promise<ApiResponse<SchoolWithCounts>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Only users with role school_admin / platform_admin can create a school.
    if (
      dbUser.role !== "school_admin" &&
      dbUser.role !== "platform_admin" &&
      dbUser.role !== "teacher"
    ) {
      throw AppError.unauthorized(
        "Only school administrators and teachers can create a school",
      );
    }

    const parsed = createSchoolSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const school = await schoolsService.createSchool(parsed.data, dbUser.id);
    logger.info("School created", {
      schoolId: school.id,
      name: school.name,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    // Return the enriched version with member / class counts.
    const enriched = await schoolsService.getSchoolById(school.id);
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("createSchoolAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create school" },
    };
  }
}

export async function updateSchoolAction(
  input: UpdateSchoolInput,
): Promise<ApiResponse<School>> {
  try {
    const { userId } = await requireSchoolAdmin(input.id);

    const parsed = updateSchoolSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const updated = await schoolsService.updateSchool(
      parsed.data.id,
      parsed.data,
    );
    logger.info("School updated", { schoolId: updated.id, byUserId: userId });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("updateSchoolAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update school" },
    };
  }
}

export async function verifySchoolAction(
  id: string,
): Promise<ApiResponse<School>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only platform admins can verify schools");
    }

    const verified = await schoolsService.verifySchool(id);
    logger.info("School verified", {
      schoolId: id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/dashboard");
    return { success: true, data: verified };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("verifySchoolAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not verify school" },
    };
  }
}

export async function inviteMemberAction(input: {
  schoolId: string;
  email: string;
  roleInSchool: "admin" | "teacher" | "student" | "parent" | "staff";
}): Promise<ApiResponse<{ invited: boolean; email: string }>> {
  try {
    const { userId } = await requireSchoolAdmin(input.schoolId);

    const parsed = inviteByEmailSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const member = await schoolsService.inviteMemberByEmail(
      parsed.data,
      userId,
    );
    logger.info("Member invited", {
      schoolId: parsed.data.schoolId,
      email: parsed.data.email,
      memberId: member.id,
      byUserId: userId,
    });
    revalidatePath("/teachers");
    revalidatePath("/students");
    return {
      success: true,
      data: { invited: true, email: parsed.data.email },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("inviteMemberAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not invite member" },
    };
  }
}

export async function removeMemberAction(
  schoolId: string,
  userId: string,
): Promise<ApiResponse<{ removed: boolean }>> {
  try {
    const { userId: actingUserId } = await requireSchoolAdmin(schoolId);

    if (actingUserId === userId) {
      throw AppError.validation("You cannot remove yourself as admin");
    }

    await schoolsService.removeMember(schoolId, userId);
    logger.info("Member removed", { schoolId, userId, byUserId: actingUserId });
    revalidatePath("/teachers");
    revalidatePath("/students");
    return { success: true, data: { removed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("removeMemberAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not remove member" },
    };
  }
}

export async function updateMemberRoleAction(
  schoolId: string,
  userId: string,
  roleInSchool: "admin" | "teacher" | "student" | "parent" | "staff",
): Promise<ApiResponse<{ roleInSchool: string }>> {
  try {
    const { userId: actingUserId } = await requireSchoolAdmin(schoolId);
    const updated = await schoolsService.updateMemberRole(
      schoolId,
      userId,
      roleInSchool,
    );
    logger.info("Member role updated", {
      schoolId,
      userId,
      role: roleInSchool,
      byUserId: actingUserId,
    });
    revalidatePath("/teachers");
    revalidatePath("/students");
    return { success: true, data: { roleInSchool: updated.roleInSchool } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("updateMemberRoleAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update role" },
    };
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getSchoolAction(
  id: string,
): Promise<ApiResponse<SchoolWithCounts>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const member = await isSchoolMember(dbUser.id, id);
    if (!member && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You are not a member of this school");
    }

    const school = await schoolsService.getSchoolById(id);
    return { success: true, data: school };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getSchoolAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load school" },
    };
  }
}

export async function getMySchoolAction(): Promise<
  ApiResponse<SchoolWithCounts | null>
> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const school = await schoolsService.getSchoolForAdminUser(dbUser.id);
    if (!school) {
      return { success: true, data: null };
    }
    const withCounts = await schoolsService.getSchoolById(school.id);
    return { success: true, data: withCounts };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getMySchoolAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load school" },
    };
  }
}

export async function listMembersAction(
  schoolId: string,
  filterRole: "student" | "teacher" | "parent" | "admin" | "staff" = "teacher",
): Promise<ApiResponse<SchoolMemberWithUser[]>> {
  try {
    const { userId } = await requireSchoolAdmin(schoolId);
    void userId; // (admin context check passed)
    const members = await schoolsService.listMembers(schoolId, filterRole);
    return { success: true, data: members };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listMembersAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load members" },
    };
  }
}

export async function listSchoolsAction(
  filters: ListSchoolsQuery,
): Promise<
  ApiResponse<{
    items: School[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    await requireSession();
    const parsed = listSchoolsQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await schoolsService.listSchools(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listSchoolsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list schools" },
    };
  }
}

/* ── Public listing (FTS + card view) ─────────────────────────── */

/**
 * Paginated listing of schools with full-text search (PostgreSQL `tsvector`)
 * and per-card counts. Used by the public `/schools` explorer.
 *
 * The current user's join code is automatically revealed on their own school
 * card (if they are the school admin).
 */
export async function listSchoolsFTSAction(input: {
  search?: string;
  city?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<
  ApiResponse<{
    items: SchoolCardData[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }>
> {
  try {
    // Public endpoint — session is optional but used to reveal the join code.
    let revealUserId: string | null = null;
    try {
      const dbUser = await getCurrentDbUser();
      if (dbUser) revealUserId = dbUser.id;
    } catch {
      // ignore — anonymous user
    }

    const type =
      input.type &&
      (SCHOOL_TYPE_VALUES as readonly string[]).includes(input.type)
        ? (input.type as "public" | "private" | "parochial" | "other")
        : undefined;

    const result = await schoolsService.listSchoolsFTS({
      search: input.search?.trim() || undefined,
      city: input.city?.trim() || undefined,
      type,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 12,
      revealJoinCodeForUserId: revealUserId,
    });

    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listSchoolsFTSAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list schools" },
    };
  }
}

/**
 * Get a school detail (with card view + counts) plus the first page of its
 * classes. The current user's join code is revealed on their own school.
 */
export async function getSchoolDetailAction(input: {
  schoolId: string;
}): Promise<
  ApiResponse<{
    school: SchoolCardData;
    classes: ClassCardData[];
  }>
> {
  try {
    // Determine if the requester is the school's admin (to reveal the join code).
    let revealJoinCode = false;
    try {
      const dbUser = await getCurrentDbUser();
      if (dbUser) {
        const member = await schoolsService.getMember(
          input.schoolId,
          dbUser.id,
        );
        revealJoinCode = Boolean(
          member &&
          member.roleInSchool === "admin" &&
          member.status === "active",
        );
      }
    } catch {
      // ignore — anonymous
    }

    const result = await schoolsService.getSchoolDetail(
      input.schoolId,
      revealJoinCode,
    );
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getSchoolDetailAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load school" },
    };
  }
}

/**
 * Paginated listing of classes for a school (with search). Used by the school
 * detail page's `<SchoolClassesExplorer>` infinite-scroll list.
 */
export async function getSchoolClassesAction(input: {
  schoolId: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<
  ApiResponse<{
    items: ClassCardData[];
    total: number;
    page: number;
    hasMore: boolean;
  }>
> {
  try {
    const result = await schoolsService.listSchoolClasses({
      schoolId: input.schoolId,
      search: input.search?.trim() || undefined,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 12,
    });
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getSchoolClassesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list classes" },
    };
  }
}
