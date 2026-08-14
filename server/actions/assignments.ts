"use server";

/**
 * §5.5 — Assignment server actions.
 *
 * Wraps the assignments service with auth + RBAC + Zod validation. Each
 * action returns a typed ApiResponse<T>.
 *
 * Permission model:
 *  - createAssignment   : teacher (must be a class teacher of the target class)
 *  - updateAssignment   : teacher (must own the assignment OR be class teacher)
 *  - deleteAssignment   : teacher (must own the assignment OR be class teacher)
 *  - publishAssignment  : teacher (must own the assignment)
 *  - getAssignment      : must be a class member / teacher / school admin / platform admin
 *  - submitAssignment   : student (must be a class member)
 *  - resubmitAssignment : student (must own the submission)
 *  - gradeSubmission    : teacher (must own the assignment or be class teacher)
 *  - returnSubmission   : teacher (must own the assignment or be class teacher)
 *  - listSubmissions    : teacher of the assignment's class
 *  - listForStudent     : student themselves
 *  - listForTeacher     : teacher themselves
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isClassMember, isClassTeacher, isSchoolMember } from "@/server/permissions";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  listAssignmentsQuerySchema,
  submitAssignmentSchema,
  resubmitAssignmentSchema,
  gradeSubmissionSchema,
  type CreateAssignmentInput,
  type UpdateAssignmentInput,
  type ListAssignmentsQuery,
  type SubmitAssignmentInput,
  type ResubmitAssignmentInput,
  type GradeSubmissionInput,
} from "@/server/validators/assignments";
import * as assignmentsService from "@/server/services/assignments";
import * as classesService from "@/server/services/classes";
import type {
  AssignmentWithRelations,
  AssignmentForStudent,
  SubmissionWithRelations,
  Submission,
} from "@/server/services/assignments";

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Resolve the current DB user + ensure they are a teacher of the class
 * identified by `classId`. Returns the user id on success.
 */
async function requireClassTeacher(
  classId: string,
): Promise<{ userId: string }> {
  const session = await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");

  const cls = await classesService.getClassById(classId);
  if (!cls) throw AppError.notFound("Class not found");

  const isTeacher = await isClassTeacher(dbUser.id, classId);
  const inSchool = cls.school?.id
    ? await isSchoolMember(dbUser.id, cls.school.id)
    : false;
  const canManage =
    dbUser.role === "platform_admin" ||
    isTeacher ||
    (inSchool && dbUser.role === "school_admin");

  if (!canManage) {
    throw AppError.unauthorized(
      "Only the class teacher, head teacher or a school admin can manage this class",
    );
  }

  return { userId: dbUser.id };
}

/**
 * Resolve the current DB user + ensure they are allowed to edit the given
 * assignment (own it OR be a teacher of the assignment's class).
 */
async function requireAssignmentEditor(
  assignmentId: string,
): Promise<{ userId: string; assignment: AssignmentWithRelations }> {
  const session = await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) throw AppError.notFound("User profile not found");

  const assignment = await assignmentsService.getAssignmentById(assignmentId);
  if (!assignment) throw AppError.notFound("Assignment not found");

  // Owner of the assignment.
  if (assignment.teacherId === dbUser.id) {
    return { userId: dbUser.id, assignment };
  }

  // Otherwise must be a teacher of the assignment's class.
  const isTeacher = await isClassTeacher(dbUser.id, assignment.classId);
  const cls = await classesService.getClassById(assignment.classId);
  const inSchool = cls?.school?.id
    ? await isSchoolMember(dbUser.id, cls.school.id)
    : false;
  const canManage =
    dbUser.role === "platform_admin" ||
    isTeacher ||
    (inSchool && dbUser.role === "school_admin");

  if (!canManage) {
    throw AppError.unauthorized(
      "Only the assignment owner or a class teacher can edit this assignment",
    );
  }

  void session;
  return { userId: dbUser.id, assignment };
}

/* ── Mutations ─────────────────────────────────────────────── */

export async function createAssignmentAction(
  input: CreateAssignmentInput,
): Promise<ApiResponse<AssignmentWithRelations>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Validate first so we know classId is well-formed.
    const parsed = createAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Permission: must be a class teacher / school admin / platform admin.
    await requireClassTeacher(parsed.data.classId);

    const created = await assignmentsService.createAssignment({
      ...parsed.data,
      teacherId: dbUser.id,
    });

    logger.info("Assignment created", {
      assignmentId: created.id,
      title: created.title,
      classId: created.classId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });

    revalidatePath("/assignments");
    revalidatePath(`/classes/${created.classId}`);
    revalidatePath("/gradebook");

    const enriched = await assignmentsService.getAssignmentById(created.id);
    if (!enriched)
      throw AppError.internal("Assignment created but could not be reloaded");
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("createAssignmentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create assignment" },
    };
  }
}

export async function updateAssignmentAction(
  input: UpdateAssignmentInput,
): Promise<ApiResponse<AssignmentWithRelations>> {
  try {
    const { userId } = await requireAssignmentEditor(input.id);

    const parsed = updateAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const updated = await assignmentsService.updateAssignment(
      parsed.data.id,
      parsed.data,
    );
    logger.info("Assignment updated", {
      assignmentId: updated.id,
      byUserId: userId,
    });

    revalidatePath("/assignments");
    revalidatePath(`/assignments/${updated.id}`);
    revalidatePath(`/classes/${updated.classId}`);
    revalidatePath("/gradebook");

    const enriched = await assignmentsService.getAssignmentById(updated.id);
    if (!enriched)
      throw AppError.internal("Assignment updated but could not be reloaded");
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("updateAssignmentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update assignment" },
    };
  }
}

export async function deleteAssignmentAction(
  id: string,
): Promise<ApiResponse<{ archived: boolean }>> {
  try {
    const { userId } = await requireAssignmentEditor(id);
    await assignmentsService.deleteAssignment(id);
    logger.info("Assignment archived", { assignmentId: id, byUserId: userId });
    revalidatePath("/assignments");
    revalidatePath("/gradebook");
    return { success: true, data: { archived: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("deleteAssignmentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not delete assignment" },
    };
  }
}

export async function publishAssignmentAction(
  id: string,
): Promise<ApiResponse<AssignmentWithRelations>> {
  try {
    const { userId } = await requireAssignmentEditor(id);
    const updated = await assignmentsService.publishAssignment(id);
    logger.info("Assignment published", {
      assignmentId: id,
      byUserId: userId,
    });
    revalidatePath("/assignments");
    revalidatePath(`/assignments/${id}`);
    const enriched = await assignmentsService.getAssignmentById(id);
    if (!enriched)
      throw AppError.internal("Assignment published but could not be reloaded");
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("publishAssignmentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not publish assignment" },
    };
  }
}

/* ── Student submission actions ────────────────────────────── */

export async function submitAssignmentAction(
  input: SubmitAssignmentInput,
): Promise<ApiResponse<Submission>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "student" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only students can submit assignments");
    }

    const parsed = submitAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Permission: the student must be a member of the assignment's class.
    const assignment = await assignmentsService.getAssignmentById(
      parsed.data.assignmentId,
    );
    if (!assignment) throw AppError.notFound("Assignment not found");

    const isMember = await isClassMember(dbUser.id, assignment.classId);
    if (!isMember && dbUser.role !== "platform_admin") {
      throw AppError.forbidden(
        "You must be a member of the class to submit this assignment",
      );
    }

    const submission = await assignmentsService.submitAssignment({
      ...parsed.data,
      studentId: dbUser.id,
    });

    logger.info("Assignment submitted", {
      assignmentId: parsed.data.assignmentId,
      submissionId: submission.id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });

    revalidatePath("/assignments");
    revalidatePath(`/assignments/${parsed.data.assignmentId}`);
    revalidatePath(`/classes/${assignment.classId}`);

    return { success: true, data: submission };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("submitAssignmentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not submit assignment" },
    };
  }
}

export async function resubmitAssignmentAction(
  input: ResubmitAssignmentInput,
): Promise<ApiResponse<Submission>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "student" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only students can resubmit assignments");
    }

    const parsed = resubmitAssignmentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Permission: must own the submission.
    const submission = await assignmentsService.getSubmission(
      parsed.data.submissionId,
    );
    if (!submission) throw AppError.notFound("Submission not found");
    if (submission.student.id !== dbUser.id && dbUser.role !== "platform_admin") {
      throw AppError.forbidden("You can only resubmit your own assignments");
    }

    const updated = await assignmentsService.resubmitAssignment(parsed.data);

    logger.info("Assignment resubmitted", {
      submissionId: updated.id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });

    revalidatePath("/assignments");
    revalidatePath(`/assignments/${updated.assignmentId}`);

    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("resubmitAssignmentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not resubmit assignment" },
    };
  }
}

/* ── Teacher grading actions ───────────────────────────────── */

export async function gradeSubmissionAction(
  input: GradeSubmissionInput,
): Promise<ApiResponse<Submission>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "teacher" && dbUser.role !== "school_admin" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only teachers can grade submissions");
    }

    const parsed = gradeSubmissionSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Permission: must be the assignment owner OR a teacher of the class.
    const submission = await assignmentsService.getSubmission(parsed.data.id);
    if (!submission) throw AppError.notFound("Submission not found");

    await requireAssignmentEditor(submission.assignment.id);

    const updated = await assignmentsService.gradeSubmission({
      ...parsed.data,
      gradedBy: dbUser.id,
    });

    logger.info("Submission graded", {
      submissionId: updated.id,
      score: updated.score,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });

    revalidatePath(`/assignments/${updated.assignmentId}`);
    revalidatePath("/assignments");
    revalidatePath("/gradebook");

    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("gradeSubmissionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not grade submission" },
    };
  }
}

export async function returnSubmissionAction(
  submissionId: string,
): Promise<ApiResponse<Submission>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "teacher" && dbUser.role !== "school_admin" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only teachers can return submissions");
    }

    const submission = await assignmentsService.getSubmission(submissionId);
    if (!submission) throw AppError.notFound("Submission not found");

    await requireAssignmentEditor(submission.assignment.id);

    const updated = await assignmentsService.returnSubmission(submissionId);

    logger.info("Submission returned", {
      submissionId,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });

    revalidatePath(`/assignments/${updated.assignmentId}`);
    revalidatePath("/assignments");
    revalidatePath("/gradebook");

    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("returnSubmissionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not return submission" },
    };
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getAssignmentAction(
  id: string,
): Promise<ApiResponse<AssignmentWithRelations>> {
  try {
    await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const assignment = await assignmentsService.getAssignmentById(id);
    if (!assignment) throw AppError.notFound("Assignment not found");

    // Permission: must be a member of the class, the teacher who created it,
    // a school admin of the school, or a platform admin.
    const [isMember, isTeacher] = await Promise.all([
      isClassMember(dbUser.id, assignment.classId),
      isClassTeacher(dbUser.id, assignment.classId),
    ]);

    const cls = await classesService.getClassById(assignment.classId);
    const inSchool = cls?.school?.id
      ? await isSchoolMember(dbUser.id, cls.school.id)
      : false;

    const canView =
      assignment.teacherId === dbUser.id ||
      isMember ||
      isTeacher ||
      inSchool ||
      dbUser.role === "platform_admin";

    if (!canView) {
      throw AppError.forbidden("You don't have access to this assignment");
    }

    return { success: true, data: assignment };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getAssignmentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load assignment" },
    };
  }
}

export async function listAssignmentsAction(
  filters: ListAssignmentsQuery,
): Promise<ApiResponse<{
  items: AssignmentWithRelations[];
  total: number;
  page: number;
  pageSize: number;
}>> {
  try {
    await requireSession();
    const parsed = listAssignmentsQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }
    const result = await assignmentsService.listAssignments(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listAssignmentsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list assignments" },
    };
  }
}

export async function listForStudentAction(): Promise<
  ApiResponse<AssignmentForStudent[]>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "student" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only students can use this view");
    }

    const items = await assignmentsService.listAssignmentsForStudent(dbUser.id);
    void session;
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listForStudentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list assignments" },
    };
  }
}

export async function listForTeacherAction(): Promise<
  ApiResponse<AssignmentWithRelations[]>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "teacher" && dbUser.role !== "school_admin" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only teachers can use this view");
    }

    const items = await assignmentsService.listAssignmentsForTeacher(dbUser.id);
    void session;
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listForTeacherAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list assignments" },
    };
  }
}

export async function listStudentSubmissionsAction(): Promise<
  ApiResponse<SubmissionWithRelations[]>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "student" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only students can view their submission history");
    }

    const items = await assignmentsService.listSubmissionsForStudent(dbUser.id);
    void session;
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listStudentSubmissionsAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not load submission history",
      },
    };
  }
}

export async function listSubmissionsAction(
  assignmentId: string,
): Promise<ApiResponse<SubmissionWithRelations[]>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    if (dbUser.role !== "teacher" && dbUser.role !== "school_admin" && dbUser.role !== "platform_admin") {
      throw AppError.unauthorized("Only teachers can view all submissions");
    }

    // Must be allowed to view the assignment.
    await requireAssignmentEditor(assignmentId);

    const items = await assignmentsService.listSubmissionsForAssignment(
      assignmentId,
    );
    void session;
    return { success: true, data: items };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listSubmissionsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list submissions" },
    };
  }
}

export async function getSubmissionAction(
  submissionId: string,
): Promise<ApiResponse<SubmissionWithRelations>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const submission = await assignmentsService.getSubmission(submissionId);
    if (!submission) throw AppError.notFound("Submission not found");

    // Permission: student owns the submission, OR teacher can view the
    // assignment.
    if (submission.student.id === dbUser.id) {
      void session;
      return { success: true, data: submission };
    }

    await requireAssignmentEditor(submission.assignment.id);
    return { success: true, data: submission };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getSubmissionAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load submission" },
    };
  }
}
