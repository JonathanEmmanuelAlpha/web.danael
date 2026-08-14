/**
 * §5.5 — Assignment service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Domain:
 *  - assignments (homework given by a teacher to a class)
 *  - assignment_items (ordered resources: file/url/text/quiz)
 *  - submissions (one per student per assignment)
 *  - submission_files (uploaded files attached to a submission)
 *  - grades (broader gradebook entry — written when a submission is graded)
 */

import {
  and,
  count,
  eq,
  inArray,
  isNull,
  asc,
  desc,
  or,
  SQL,
} from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  assignments,
  assignmentItems,
  submissions,
  submissionFiles,
  grades,
  classes,
  subjects,
  users,
  classMembers,
  files as filesTable,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ListAssignmentsQuery,
  SubmitAssignmentInput,
  ResubmitAssignmentInput,
  GradeSubmissionInput,
  AssignmentItemInput,
} from "@/server/validators/assignments";
import type {
  Assignment,
  AssignmentItem,
  Submission,
  SubmissionFile,
  Grade,
} from "@/server/db/schema/assignments";
import type { Class, Subject } from "@/server/db/schema/schools";
import type { User } from "@/server/db/schema/users";
import type { File } from "@/server/db/schema/contents";

/* ── Types ─────────────────────────────────────────────────── */

export type { Assignment, AssignmentItem, Submission, SubmissionFile, Grade };

export type AssignmentWithRelations = Assignment & {
  class: Pick<Class, "id" | "name" | "level" | "series"> | null;
  subject: Pick<Subject, "id" | "name" | "code"> | null;
  teacher: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl"
  > | null;
  items: AssignmentItem[];
  /** Submission counts (only relevant for teachers). */
  submissionsCount: number;
  gradedCount: number;
};

export type AssignmentForStudent = AssignmentWithRelations & {
  /** The current student's submission (if any). */
  mySubmission: SubmissionSummary | null;
  /** Whether the assignment is currently late for this student. */
  isLate: boolean;
};

export type SubmissionSummary = Pick<
  Submission,
  "id" | "status" | "submittedAt" | "score" | "gradedAt"
>;

export type SubmissionFileMeta = Pick<
  File,
  "id" | "originalName" | "contentType" | "size" | "key"
>;

export type SubmissionWithRelations = Submission & {
  student: Pick<User, "id" | "firstName" | "lastName" | "email" | "avatarUrl">;
  files: SubmissionFileMeta[];
  assignment: Pick<Assignment, "id" | "title" | "points" | "dueAt">;
};

/* ── Mutations ─────────────────────────────────────────────── */

/**
 * Create a new assignment (with optional items).
 * The caller MUST ensure the teacher is a teacher of the class.
 */
export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<Assignment> {
  const db = await getDb();

  // Verify class exists.
  const classRows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, input.classId))
    .limit(1);
  if (classRows.length === 0) {
    throw AppError.notFound("Class not found");
  }

  const [created] = await db
    .insert(assignments)
    .values({
      title: input.title,
      description: input.description,
      classId: input.classId,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      points: input.points,
      allowLateSubmission: input.allowLateSubmission,
      status: input.status,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create assignment");

  // Insert items if provided.
  if (input.items.length > 0) {
    await db.insert(assignmentItems).values(
      input.items.map((item, index) => ({
        assignmentId: created.id,
        type: item.type,
        contentId: item.contentId,
        url:
          item.type === "url"
            ? item.url
            : item.type === "text"
              ? item.text
              : null,
        position: item.position ?? index,
      })),
    );
  }

  return created;
}

/**
 * Update editable assignment fields. Items are NOT touched here — they are
 * managed through a separate API (addItem / removeItem).
 */
export async function updateAssignment(
  id: string,
  input: UpdateAssignmentInput,
): Promise<Assignment> {
  const db = await getDb();
  const [updated] = await db
    .update(assignments)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.classId !== undefined ? { classId: input.classId } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
      ...(input.dueAt !== undefined
        ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
        : {}),
      ...(input.points !== undefined ? { points: input.points } : {}),
      ...(input.allowLateSubmission !== undefined
        ? { allowLateSubmission: input.allowLateSubmission }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(assignments.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Assignment not found");
  return updated;
}

/**
 * Soft-delete an assignment (status = "archived").
 */
export async function deleteAssignment(id: string): Promise<void> {
  const db = await getDb();
  const [updated] = await db
    .update(assignments)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(assignments.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Assignment not found");
}

/**
 * Publish an assignment (draft → published).
 */
export async function publishAssignment(id: string): Promise<Assignment> {
  const db = await getDb();
  const [updated] = await db
    .update(assignments)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(assignments.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Assignment not found");
  return updated;
}

/* ── Items ─────────────────────────────────────────────────── */

export async function addAssignmentItem(
  input: AssignmentItemInput & { assignmentId: string },
): Promise<AssignmentItem> {
  const db = await getDb();
  const [created] = await db
    .insert(assignmentItems)
    .values({
      assignmentId: input.assignmentId,
      type: input.type,
      contentId: input.contentId,
      url:
        input.type === "url"
          ? input.url
          : input.type === "text"
            ? input.text
            : null,
      position: input.position,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to add assignment item");
  return created;
}

export async function removeAssignmentItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(assignmentItems).where(eq(assignmentItems.id, id));
}

/* ── Queries ───────────────────────────────────────────────── */

/**
 * Get a single assignment with class / subject / teacher / items.
 */
export async function getAssignmentById(
  id: string,
): Promise<AssignmentWithRelations | null> {
  const db = await getDb();
  const rows = await db
    .select({
      assignment: assignments,
      class: {
        id: classes.id,
        name: classes.name,
        level: classes.level,
        series: classes.series,
      },
      subject: {
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
      },
      teacher: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(assignments)
    .leftJoin(classes, eq(classes.id, assignments.classId))
    .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
    .leftJoin(users, eq(users.id, assignments.teacherId))
    .where(eq(assignments.id, id))
    .limit(1);

  const row = rows.at(0);
  if (!row) return null;

  const items = await db
    .select()
    .from(assignmentItems)
    .where(eq(assignmentItems.assignmentId, id))
    .orderBy(asc(assignmentItems.position), asc(assignmentItems.createdAt));

  const [submissionsCount, gradedCount] = await Promise.all([
    countSubmissions(id),
    countSubmissionsByStatus(id, ["graded", "returned"]),
  ]);

  return {
    ...row.assignment,
    class: row.class?.id ? row.class : null,
    subject: row.subject?.id ? row.subject : null,
    teacher: row.teacher?.id ? row.teacher : null,
    items,
    submissionsCount,
    gradedCount,
  };
}

/**
 * List assignments filtered by class, teacher, student or status.
 * Returns enriched assignments with relations + counts.
 */
export async function listAssignments(filters: ListAssignmentsQuery): Promise<{
  items: AssignmentWithRelations[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();
  const conditions: SQL<unknown>[] = [];

  if (filters.classId)
    conditions.push(eq(assignments.classId, filters.classId) as never);
  if (filters.teacherId)
    conditions.push(eq(assignments.teacherId, filters.teacherId) as never);
  if (filters.status)
    conditions.push(eq(assignments.status, filters.status) as never);

  // Filter by student → assignments in the student's classes.
  if (filters.studentId) {
    const studentClasses = await db
      .select({ classId: classMembers.classId })
      .from(classMembers)
      .where(
        and(
          eq(classMembers.userId, filters.studentId),
          eq(classMembers.role, "student"),
        ),
      );
    const ids = studentClasses.map((r) => r.classId);
    if (ids.length === 0) {
      return {
        items: [],
        total: 0,
        page: filters.page,
        pageSize: filters.pageSize,
      };
    }
    conditions.push(inArray(assignments.classId, ids) as never);
  }

  // Hide archived assignments unless explicitly requested.
  if (!filters.status) {
    conditions.push(
      or(
        eq(assignments.status, "published"),
        eq(assignments.status, "draft"),
        eq(assignments.status, "scheduled"),
        eq(assignments.status, "closed"),
      ) as never,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const baseQuery = db
    .select({
      assignment: assignments,
      class: {
        id: classes.id,
        name: classes.name,
        level: classes.level,
        series: classes.series,
      },
      subject: {
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
      },
      teacher: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(assignments)
    .leftJoin(classes, eq(classes.id, assignments.classId))
    .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
    .leftJoin(users, eq(users.id, assignments.teacherId))
    .$dynamic();

  const rows = await baseQuery
    .where(where)
    .orderBy(desc(assignments.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

  const totalRow = await db
    .select({ c: count() })
    .from(assignments)
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  const items: AssignmentWithRelations[] = [];
  for (const r of rows) {
    const [subCount, gradedCount] = await Promise.all([
      countSubmissions(r.assignment.id),
      countSubmissionsByStatus(r.assignment.id, ["graded", "returned"]),
    ]);
    const itemRows = await db
      .select()
      .from(assignmentItems)
      .where(eq(assignmentItems.assignmentId, r.assignment.id))
      .orderBy(asc(assignmentItems.position), asc(assignmentItems.createdAt));
    items.push({
      ...r.assignment,
      class: r.class?.id ? r.class : null,
      subject: r.subject?.id ? r.subject : null,
      teacher: r.teacher?.id ? r.teacher : null,
      items: itemRows,
      submissionsCount: subCount,
      gradedCount,
    });
  }

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/**
 * Convenience wrapper: assignments created by a given teacher.
 */
export async function listAssignmentsForTeacher(
  teacherId: string,
): Promise<AssignmentWithRelations[]> {
  const result = await listAssignments({
    teacherId,
    page: 1,
    pageSize: 100,
  });
  return result.items;
}

/**
 * Convenience wrapper: assignments attached to a given class.
 */
export async function listAssignmentsForClass(
  classId: string,
): Promise<AssignmentWithRelations[]> {
  const result = await listAssignments({
    classId,
    page: 1,
    pageSize: 100,
  });
  return result.items;
}

/**
 * List assignments visible to a given student (i.e. assignments in the
 * classes they're enrolled in, with status published/closed), enriched with
 * the student's own submission summary.
 */
export async function listAssignmentsForStudent(
  studentId: string,
): Promise<AssignmentForStudent[]> {
  const db = await getDb();

  // Find the student's classes.
  const studentClasses = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(
      and(eq(classMembers.userId, studentId), eq(classMembers.role, "student")),
    );
  const classIds = studentClasses.map((r) => r.classId);
  if (classIds.length === 0) return [];

  const rows = await db
    .select({
      assignment: assignments,
      class: {
        id: classes.id,
        name: classes.name,
        level: classes.level,
        series: classes.series,
      },
      subject: {
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
      },
      teacher: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(assignments)
    .leftJoin(classes, eq(classes.id, assignments.classId))
    .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
    .leftJoin(users, eq(users.id, assignments.teacherId))
    .where(
      and(
        inArray(assignments.classId, classIds),
        or(
          eq(assignments.status, "published"),
          eq(assignments.status, "closed"),
        ),
      ),
    )
    .orderBy(desc(assignments.createdAt));

  const enriched: AssignmentForStudent[] = [];
  for (const r of rows) {
    const [items, mySubmission, subCount, gradedCount] = await Promise.all([
      db
        .select()
        .from(assignmentItems)
        .where(eq(assignmentItems.assignmentId, r.assignment.id))
        .orderBy(asc(assignmentItems.position), asc(assignmentItems.createdAt)),
      getStudentSubmission(r.assignment.id, studentId),
      countSubmissions(r.assignment.id),
      countSubmissionsByStatus(r.assignment.id, ["graded", "returned"]),
    ]);

    const isLate = checkLateSubmission(r.assignment);

    enriched.push({
      ...r.assignment,
      class: r.class?.id ? r.class : null,
      subject: r.subject?.id ? r.subject : null,
      teacher: r.teacher?.id ? r.teacher : null,
      items,
      submissionsCount: subCount,
      gradedCount,
      mySubmission,
      isLate,
    });
  }

  return enriched;
}

/* ── Submissions ───────────────────────────────────────────── */

/**
 * Submit an assignment (creates the submission row + links files).
 * Idempotent: if a submission already exists for this student/assignment,
 * it's updated instead (status → submitted).
 */
export async function submitAssignment(
  input: SubmitAssignmentInput,
): Promise<Submission> {
  const db = await getDb();

  // Look up the assignment (for late check + points).
  const assignmentRows = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, input.assignmentId))
    .limit(1);
  const assignment = assignmentRows.at(0);
  if (!assignment) throw AppError.notFound("Assignment not found");

  // Reject submission if the assignment is still in draft / archived.
  if (assignment.status === "archived") {
    throw AppError.validation("This assignment has been archived");
  }

  const isLate = checkLateSubmission(assignment);
  if (isLate && !assignment.allowLateSubmission) {
    throw AppError.validation(
      "The deadline has passed and late submissions are not allowed",
    );
  }

  // Look up existing submission for this student/assignment.
  const existingRows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, input.assignmentId),
        eq(submissions.studentId, input.studentId),
      ),
    )
    .limit(1);
  const existing = existingRows.at(0);

  const status: typeof submissions.$inferInsert.status = isLate
    ? "late"
    : "submitted";

  if (existing) {
    const [updated] = await db
      .update(submissions)
      .set({
        status,
        submittedAt: new Date(),
        // Reset grading fields if re-submitting before grading.
        ...(existing.status === "not_started" || existing.status === "submitted"
          ? { score: null, feedback: null, gradedBy: null, gradedAt: null }
          : {}),
        ...(input.comment !== undefined ? { feedback: input.comment } : {}),
      })
      .where(eq(submissions.id, existing.id))
      .returning();

    if (!updated) throw AppError.internal("Failed to update submission");

    // Replace attached files.
    await db
      .delete(submissionFiles)
      .where(eq(submissionFiles.submissionId, updated.id));
    if (input.fileIds.length > 0) {
      await db.insert(submissionFiles).values(
        input.fileIds.map((fileId) => ({
          submissionId: updated.id,
          fileId,
        })),
      );
    }

    return updated;
  }

  const [created] = await db
    .insert(submissions)
    .values({
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      status,
      submittedAt: new Date(),
      feedback: input.comment ?? null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create submission");

  if (input.fileIds.length > 0) {
    await db.insert(submissionFiles).values(
      input.fileIds.map((fileId) => ({
        submissionId: created.id,
        fileId,
      })),
    );
  }

  return created;
}

/**
 * Update an existing submission before the deadline.
 */
export async function resubmitAssignment(
  input: ResubmitAssignmentInput,
): Promise<Submission> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, input.submissionId))
    .limit(1);
  const submission = rows.at(0);
  if (!submission) throw AppError.notFound("Submission not found");

  // Look up the assignment for the deadline check.
  const assignmentRows = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);
  const assignment = assignmentRows.at(0);
  if (!assignment) throw AppError.notFound("Assignment not found");

  const isLate = checkLateSubmission(assignment);
  if (isLate && !assignment.allowLateSubmission) {
    throw AppError.validation(
      "The deadline has passed and late submissions are not allowed",
    );
  }

  // Already graded → can't resubmit.
  if (submission.status === "graded" || submission.status === "returned") {
    throw AppError.validation(
      "This submission has already been graded and can no longer be modified",
    );
  }

  const status = isLate ? "late" : "submitted";

  const [updated] = await db
    .update(submissions)
    .set({
      status,
      submittedAt: new Date(),
      // Reset grading fields (in case a teacher started grading then student resubmits).
      score: null,
      gradedBy: null,
      gradedAt: null,
      ...(input.comment !== undefined ? { feedback: input.comment } : {}),
    })
    .where(eq(submissions.id, input.submissionId))
    .returning();

  if (!updated) throw AppError.internal("Failed to update submission");

  // Replace attached files.
  await db
    .delete(submissionFiles)
    .where(eq(submissionFiles.submissionId, input.submissionId));
  if (input.fileIds.length > 0) {
    await db.insert(submissionFiles).values(
      input.fileIds.map((fileId) => ({
        submissionId: input.submissionId,
        fileId,
      })),
    );
  }

  return updated;
}

/**
 * Get a single submission with relations.
 */
export async function getSubmission(
  submissionId: string,
): Promise<SubmissionWithRelations | null> {
  const db = await getDb();
  const rows = await db
    .select({
      submission: submissions,
      student: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
      assignment: {
        id: assignments.id,
        title: assignments.title,
        points: assignments.points,
        dueAt: assignments.dueAt,
      },
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.studentId))
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  const row = rows.at(0);
  if (!row) return null;

  const files = await getSubmissionFiles(submissionId);

  return {
    ...row.submission,
    student: row.student,
    assignment: row.assignment,
    files,
  };
}

/**
 * List all submissions for a given assignment (teacher view).
 */
export async function listSubmissionsForAssignment(
  assignmentId: string,
): Promise<SubmissionWithRelations[]> {
  const db = await getDb();

  const rows = await db
    .select({
      submission: submissions,
      student: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
      assignment: {
        id: assignments.id,
        title: assignments.title,
        points: assignments.points,
        dueAt: assignments.dueAt,
      },
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.studentId))
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.assignmentId, assignmentId))
    .orderBy(submissions.submittedAt);

  const submissionIds = rows.map((r) => r.submission.id);
  let filesBySubmission = new Map<string, SubmissionFileMeta[]>();
  if (submissionIds.length > 0) {
    const sfRows = await db
      .select()
      .from(submissionFiles)
      .where(inArray(submissionFiles.submissionId, submissionIds));
    const fileIds = sfRows.map((r) => r.fileId);
    let fileMetaMap = new Map<string, SubmissionFileMeta>();
    if (fileIds.length > 0) {
      const metaRows = await db
        .select({
          id: filesTable.id,
          originalName: filesTable.originalName,
          contentType: filesTable.contentType,
          size: filesTable.size,
          key: filesTable.key,
        })
        .from(filesTable)
        .where(inArray(filesTable.id, fileIds));
      for (const m of metaRows) {
        fileMetaMap.set(m.id, m);
      }
    }
    for (const sf of sfRows) {
      const list = filesBySubmission.get(sf.submissionId) ?? [];
      const meta = fileMetaMap.get(sf.fileId);
      if (meta) list.push(meta);
      filesBySubmission.set(sf.submissionId, list);
    }
  }

  return rows.map((r) => ({
    ...r.submission,
    student: r.student,
    assignment: r.assignment,
    files: filesBySubmission.get(r.submission.id) ?? [],
  }));
}

/**
 * List all submissions made by a given student (history view).
 */
export async function listSubmissionsForStudent(
  studentId: string,
): Promise<SubmissionWithRelations[]> {
  const db = await getDb();
  const rows = await db
    .select({
      submission: submissions,
      student: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
      assignment: {
        id: assignments.id,
        title: assignments.title,
        points: assignments.points,
        dueAt: assignments.dueAt,
      },
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.studentId))
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.studentId, studentId))
    .orderBy(desc(submissions.submittedAt));

  return rows.map((r) => ({
    ...r.submission,
    student: r.student,
    assignment: r.assignment,
    files: [],
  }));
}

/**
 * Grade a submission (sets score, feedback, status=graded).
 * Also writes a `grades` row so the gradebook picks it up.
 */
export async function gradeSubmission(
  input: GradeSubmissionInput,
): Promise<Submission> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, input.id))
    .limit(1);
  const submission = rows.at(0);
  if (!submission) throw AppError.notFound("Submission not found");

  // Look up the assignment for class/subject/points.
  const assignmentRows = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);
  const assignment = assignmentRows.at(0);
  if (!assignment) throw AppError.notFound("Assignment not found");

  const now = new Date();
  const [updated] = await db
    .update(submissions)
    .set({
      score: input.score.toString(),
      feedback: input.feedback ?? submission.feedback,
      gradedBy: input.gradedBy,
      gradedAt: now,
      status: input.status,
    })
    .where(eq(submissions.id, input.id))
    .returning();
  if (!updated) throw AppError.internal("Failed to grade submission");

  // Upsert the corresponding grades row (one per submission).
  const existingGradeRows = await db
    .select()
    .from(grades)
    .where(eq(grades.assignmentId, assignment.id));
  const existingGrade = existingGradeRows.find(
    (g) => g.studentId === submission.studentId,
  );

  const maxScore = assignment.points ?? 20;
  if (existingGrade) {
    await db
      .update(grades)
      .set({
        score: input.score.toString(),
        maxScore: maxScore.toString(),
        comment: input.feedback ?? existingGrade.comment,
        gradedBy: input.gradedBy,
        updatedAt: now,
      })
      .where(eq(grades.id, existingGrade.id));
  } else {
    await db.insert(grades).values({
      studentId: submission.studentId,
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      assignmentId: assignment.id,
      score: input.score.toString(),
      maxScore: maxScore.toString(),
      period: "T1",
      comment: input.feedback,
      gradedBy: input.gradedBy,
    });
  }

  return updated;
}

/**
 * Mark a submission as "returned" to the student (re-open for revision).
 */
export async function returnSubmission(
  submissionId: string,
): Promise<Submission> {
  const db = await getDb();
  const [updated] = await db
    .update(submissions)
    .set({ status: "returned", updatedAt: new Date() })
    .where(eq(submissions.id, submissionId))
    .returning();
  if (!updated) throw AppError.notFound("Submission not found");
  return updated;
}

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Returns true if the assignment's deadline has passed.
 */
export function checkLateSubmission(
  assignment: Pick<Assignment, "dueAt">,
): boolean {
  if (!assignment.dueAt) return false;
  return assignment.dueAt.getTime() < Date.now();
}

async function getStudentSubmission(
  assignmentId: string,
  studentId: string,
): Promise<SubmissionSummary | null> {
  const db = await getDb();
  const rows = await db
    .select({
      id: submissions.id,
      status: submissions.status,
      submittedAt: submissions.submittedAt,
      score: submissions.score,
      gradedAt: submissions.gradedAt,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.studentId, studentId),
      ),
    )
    .limit(1);
  return rows.at(0) ?? null;
}

async function getSubmissionFiles(
  submissionId: string,
): Promise<SubmissionFileMeta[]> {
  const db = await getDb();
  const sfRows = await db
    .select()
    .from(submissionFiles)
    .where(eq(submissionFiles.submissionId, submissionId));
  if (sfRows.length === 0) return [];
  const fileIds = sfRows.map((r) => r.fileId);
  const metaRows = await db
    .select({
      id: filesTable.id,
      originalName: filesTable.originalName,
      contentType: filesTable.contentType,
      size: filesTable.size,
      key: filesTable.key,
    })
    .from(filesTable)
    .where(inArray(filesTable.id, fileIds));
  return metaRows;
}

async function countSubmissions(assignmentId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(submissions)
    .where(eq(submissions.assignmentId, assignmentId));
  return Number(rows.at(0)?.c ?? 0);
}

async function countSubmissionsByStatus(
  assignmentId: string,
  statuses: Array<Submission["status"]>,
): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        inArray(submissions.status, statuses),
      ),
    );
  return Number(rows.at(0)?.c ?? 0);
}

// Suppress unused-import warnings for symbols kept for clarity / future use.
void isNull;
