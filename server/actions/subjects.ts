"use server";

/**
 * §5.3 — Subject server actions.
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isSchoolMember } from "@/server/permissions";
import {
  createSubjectSchema,
  updateSubjectSchema,
  assignSubjectSchema,
  updateClassSubjectSchema,
  type CreateSubjectInput,
  type UpdateSubjectInput,
  type AssignSubjectInput,
  type UpdateClassSubjectInput,
} from "@/server/validators/subjects";
import * as subjectsService from "@/server/services/subjects";
import * as classesService from "@/server/services/classes";
import type { Subject } from "@/server/db/schema/schools";
import type {
  ClassSubjectWithRelations,
} from "@/server/services/classes";

/* ── Mutations ─────────────────────────────────────────────── */

export async function createSubjectAction(
  input: CreateSubjectInput,
): Promise<ApiResponse<Subject>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "platform_admin" && dbUser.role !== "school_admin") {
      throw AppError.unauthorized(
        "Only platform or school admins can create subjects",
      );
    }

    const parsed = createSubjectSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const subject = await subjectsService.createSubject(parsed.data);
    logger.info("Subject created", {
      subjectId: subject.id,
      code: subject.code,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    return { success: true, data: subject };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("createSubjectAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create subject" },
    };
  }
}

export async function updateSubjectAction(
  input: UpdateSubjectInput,
): Promise<ApiResponse<Subject>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "platform_admin" && dbUser.role !== "school_admin") {
      throw AppError.unauthorized(
        "Only platform or school admins can update subjects",
      );
    }

    const parsed = updateSubjectSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const subject = await subjectsService.updateSubject(parsed.data.id, parsed.data);
    logger.info("Subject updated", { subjectId: subject.id, byUserId: dbUser.id });
    revalidatePath("/classes");
    return { success: true, data: subject };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("updateSubjectAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update subject" },
    };
  }
}

export async function assignSubjectAction(
  input: AssignSubjectInput,
): Promise<ApiResponse<ClassSubjectWithRelations>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Must be a teacher or admin in the school that owns the class.
    const cls = await classesService.getClassById(input.classId);
    if (!cls) throw AppError.notFound("Class not found");

    const inSchool = cls.school?.id
      ? await isSchoolMember(dbUser.id, cls.school.id)
      : false;
    if (!inSchool && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized(
        "You must be a member of the school to assign subjects",
      );
    }

    const parsed = assignSubjectSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const classSubject = await subjectsService.assignSubjectToClass(parsed.data);
    logger.info("Subject assigned to class", {
      classSubjectId: classSubject.id,
      classId: parsed.data.classId,
      subjectId: parsed.data.subjectId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });

    // Re-fetch with relations.
    const subjects = await classesService.listClassSubjects(parsed.data.classId);
    const enriched = subjects.find((s) => s.id === classSubject.id);
    if (!enriched) throw AppError.internal("Subject assigned but could not be reloaded");
    revalidatePath(`/classes/${parsed.data.classId}`);
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("assignSubjectAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not assign subject" },
    };
  }
}

export async function updateClassSubjectAction(
  input: UpdateClassSubjectInput,
): Promise<ApiResponse<ClassSubjectWithRelations>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = updateClassSubjectSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const updated = await subjectsService.updateClassSubject(parsed.data);
    logger.info("Class subject updated", {
      classSubjectId: updated.id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });

    // Re-fetch with relations for the response.
    const subjects = await classesService.listClassSubjects(updated.classId);
    const enriched = subjects.find((s) => s.id === updated.id);
    if (!enriched) throw AppError.internal("Class subject updated but could not be reloaded");
    revalidatePath(`/classes/${updated.classId}`);
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("updateClassSubjectAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not update class subject",
      },
    };
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function listSubjectsAction(): Promise<ApiResponse<Subject[]>> {
  try {
    await requireSession();
    const items = await subjectsService.listSubjects();
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listSubjectsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load subjects" },
    };
  }
}

export async function deleteSubjectAction(
  id: string,
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "platform_admin" && dbUser.role !== "school_admin") {
      throw AppError.unauthorized(
        "Only platform or school admins can delete subjects",
      );
    }

    await subjectsService.deleteSubject(id);
    logger.info("Subject deleted", {
      subjectId: id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/admin/subjects");
    revalidatePath("/school/subjects");
    return { success: true, data: { id } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("deleteSubjectAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not delete subject" },
    };
  }
}

export async function removeClassSubjectAction(
  classSubjectId: string,
): Promise<ApiResponse<{ id: string }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    await subjectsService.removeClassSubject(classSubjectId);
    logger.info("Class subject removed", {
      classSubjectId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    return { success: true, data: { id: classSubjectId } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("removeClassSubjectAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not remove class subject" },
    };
  }
}
