"use server";

/**
 * §5.3 — Class server actions.
 *
 * Wraps the classes service with auth + RBAC + Zod validation. Each action
 * returns a typed ApiResponse<T>.
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isClassMember, isClassTeacher, isSchoolMember } from "@/server/permissions";
import {
  createClassSchema,
  joinClassSchema,
  updateClassSchema,
  listClassesQuerySchema,
  type CreateClassInput,
  type JoinClassInput,
  type UpdateClassInput,
  type ListClassesQuery,
} from "@/server/validators/classes";
import * as classesService from "@/server/services/classes";
import type {
  ClassWithRelations,
  ClassMemberWithUser,
  ClassSubjectWithRelations,
} from "@/server/services/classes";

/* ── Helpers ───────────────────────────────────────────────── */

async function requireClassEditor(
  classId: string,
): Promise<{ userId: string; cls: ClassWithRelations }> {
  const session = await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");

  const cls = await classesService.getClassById(classId);
  if (!cls) throw AppError.notFound("Class not found");

  const isTeacher = await isClassTeacher(dbUser.id, classId);
  const inSchool = cls.school?.id
    ? await isSchoolMember(dbUser.id, cls.school.id)
    : false;

  const canEdit =
    dbUser.role === "platform_admin" ||
    isTeacher ||
    (inSchool && dbUser.role === "school_admin");

  if (!canEdit) {
    throw AppError.unauthorized(
      "Only the class teacher, head teacher or a school admin can edit this class",
    );
  }

  return { userId: dbUser.id, cls };
}

/* ── Mutations ─────────────────────────────────────────────── */

export async function createClassAction(
  input: CreateClassInput,
): Promise<ApiResponse<ClassWithRelations>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Only school_admin (or platform_admin) — and they must be a member of
    // the school — can create a class. Teachers can no longer create classes;
    // they join existing classes via invite code or are assigned by the admin.
    const inSchool = await isSchoolMember(dbUser.id, input.schoolId);
    const canCreate =
      dbUser.role === "platform_admin" ||
      (inSchool && dbUser.role === "school_admin");
    if (!canCreate) {
      throw AppError.unauthorized(
        "Seul un administrateur d'établissement (school_admin) peut créer une classe",
      );
    }

    const parsed = createClassSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const cls = await classesService.createClass(parsed.data, dbUser.id);
    logger.info("Class created", {
      classId: cls.id,
      schoolId: cls.schoolId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/classes");
    const enriched = await classesService.getClassById(cls.id);
    if (!enriched) throw AppError.internal("Class created but could not be reloaded");
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("createClassAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create class" },
    };
  }
}

export async function updateClassAction(
  input: UpdateClassInput,
): Promise<ApiResponse<ClassWithRelations>> {
  try {
    const { userId } = await requireClassEditor(input.id);

    const parsed = updateClassSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const updated = await classesService.updateClass(parsed.data.id, parsed.data);
    logger.info("Class updated", { classId: updated.id, byUserId: userId });
    revalidatePath(`/classes/${updated.id}`);
    revalidatePath("/classes");
    const enriched = await classesService.getClassById(updated.id);
    if (!enriched) throw AppError.internal("Class updated but could not be reloaded");
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("updateClassAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update class" },
    };
  }
}

export async function archiveClassAction(
  id: string,
): Promise<ApiResponse<{ archived: boolean }>> {
  try {
    const { userId } = await requireClassEditor(id);
    await classesService.archiveClass(id);
    logger.info("Class archived", { classId: id, byUserId: userId });
    revalidatePath("/classes");
    return { success: true, data: { archived: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("archiveClassAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not archive class" },
    };
  }
}

export async function joinClassAction(
  input: JoinClassInput,
): Promise<ApiResponse<ClassWithRelations>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = joinClassSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const cls = await classesService.joinClassByCode(
      parsed.data.inviteCode,
      dbUser.id,
      parsed.data.role,
    );
    logger.info("User joined class", {
      classId: cls.id,
      byUserId: dbUser.id,
      role: parsed.data.role,
      clerkId: session.clerkId,
    });
    revalidatePath("/classes");
    revalidatePath(`/classes/${cls.id}`);
    const enriched = await classesService.getClassById(cls.id);
    if (!enriched) throw AppError.internal("Class joined but could not be reloaded");
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("joinClassAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not join class" },
    };
  }
}

export async function removeMemberAction(
  classId: string,
  userId: string,
): Promise<ApiResponse<{ removed: boolean }>> {
  try {
    const { userId: actingUserId } = await requireClassEditor(classId);
    if (actingUserId === userId) {
      throw AppError.validation("Use the leave action to remove yourself");
    }
    await classesService.removeMember(classId, userId);
    logger.info("Class member removed", {
      classId,
      userId,
      byUserId: actingUserId,
    });
    revalidatePath(`/classes/${classId}`);
    return { success: true, data: { removed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("removeMemberAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not remove member" },
    };
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getClassAction(
  id: string,
): Promise<ApiResponse<ClassWithRelations>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const cls = await classesService.getClassById(id);
    if (!cls) throw AppError.notFound("Class not found");

    // Anyone who is a member, a school member, or platform admin can view.
    const [isMember, inSchool] = await Promise.all([
      isClassMember(dbUser.id, id),
      cls.school?.id ? isSchoolMember(dbUser.id, cls.school.id) : false,
    ]);
    if (
      !isMember &&
      !inSchool &&
      dbUser.role !== "platform_admin"
    ) {
      throw AppError.forbidden("You are not a member of this class");
    }

    return { success: true, data: cls };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getClassAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load class" },
    };
  }
}

export async function listClassesAction(
  filters: ListClassesQuery,
): Promise<ApiResponse<{ items: ClassWithRelations[]; total: number; page: number; pageSize: number }>> {
  try {
    await requireSession();
    const parsed = listClassesQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await classesService.listClasses(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listClassesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list classes" },
    };
  }
}

export async function listMembersAction(
  classId: string,
): Promise<ApiResponse<ClassMemberWithUser[]>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const cls = await classesService.getClassById(classId);
    if (!cls) throw AppError.notFound("Class not found");

    const [isMember, inSchool] = await Promise.all([
      isClassMember(dbUser.id, classId),
      cls.school?.id ? isSchoolMember(dbUser.id, cls.school.id) : false,
    ]);
    if (!isMember && !inSchool && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You are not a member of this class");
    }

    const members = await classesService.listClassMembers(classId);
    return { success: true, data: members };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listMembersAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load members" },
    };
  }
}

export async function listClassSubjectsAction(
  classId: string,
): Promise<ApiResponse<ClassSubjectWithRelations[]>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const cls = await classesService.getClassById(classId);
    if (!cls) throw AppError.notFound("Class not found");

    const [isMember, inSchool] = await Promise.all([
      isClassMember(dbUser.id, classId),
      cls.school?.id ? isSchoolMember(dbUser.id, cls.school.id) : false,
    ]);
    if (!isMember && !inSchool && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You are not a member of this class");
    }

    const subjects = await classesService.listClassSubjects(classId);
    return { success: true, data: subjects };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listClassSubjectsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load subjects" },
    };
  }
}
