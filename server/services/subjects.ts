/**
 * §5.3 — Subject service (business logic).
 */

import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db";
import { classSubjects, subjects } from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  AssignSubjectInput,
  UpdateClassSubjectInput,
} from "@/server/validators/subjects";
import type { Subject, ClassSubject } from "@/server/db/schema/schools";
import type { User } from "@/server/db/schema/users";

/* -- Types --------------------------------------------------- */

export type ClassSubjectWithRelations = ClassSubject & {
  subject: Subject;
  teacher: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl"
  > | null;
};

/* -- Mutations ----------------------------------------------- */

export async function createSubject(
  input: CreateSubjectInput,
): Promise<Subject> {
  const db = await getDb();

  // Check code uniqueness.
  const existing = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.code, input.code))
    .limit(1);
  if (existing.length > 0) {
    throw AppError.conflict("Subject code already in use", {
      code: input.code,
    });
  }

  const [created] = await db
    .insert(subjects)
    .values({
      name: input.name,
      code: input.code,
      description: input.description,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create subject");
  return created;
}

export async function updateSubject(
  id: string,
  input: UpdateSubjectInput,
): Promise<Subject> {
  const db = await getDb();
  const [updated] = await db
    .update(subjects)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(subjects.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Subject not found");
  return updated;
}

export async function deleteSubject(id: string): Promise<void> {
  const db = await getDb();
  // Note: class_subjects has ON DELETE RESTRICT for subject_id, so this
  // will throw if any class is still using the subject. The UI should
  // warn the user before calling this.
  await db.delete(subjects).where(eq(subjects.id, id));
}

export async function removeClassSubject(classSubject_id: string): Promise<void> {
  const db = await getDb();
  await db.delete(classSubjects).where(eq(classSubjects.id, classSubject_id));
}

export async function assignSubjectToClass(
  input: AssignSubjectInput,
): Promise<ClassSubject> {
  const db = await getDb();

  // Idempotent: if already assigned, update coefficient + teacher.
  const existing = await db
    .select()
    .from(classSubjects)
    .where(
      and(
        eq(classSubjects.classId, input.classId),
        eq(classSubjects.subjectId, input.subjectId),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    const [updated] = await db
      .update(classSubjects)
      .set({
        coefficient: input.coefficient,
        ...(input.teacherId !== undefined
          ? { teacherId: input.teacherId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(classSubjects.id, existing[0].id))
      .returning();
    if (!updated) throw AppError.internal("Failed to update class subject");
    return updated;
  }

  const [created] = await db
    .insert(classSubjects)
    .values({
      classId: input.classId,
      subjectId: input.subjectId,
      coefficient: input.coefficient,
      teacherId: input.teacherId,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to assign subject to class");
  return created;
}

export async function updateClassSubject(
  input: UpdateClassSubjectInput,
): Promise<ClassSubject> {
  const db = await getDb();
  const [updated] = await db
    .update(classSubjects)
    .set({
      ...(input.coefficient !== undefined
        ? { coefficient: input.coefficient }
        : {}),
      ...(input.teacherId !== undefined ? { teacherId: input.teacherId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(classSubjects.id, input.id))
    .returning();
  if (!updated) throw AppError.notFound("Class subject not found");
  return updated;
}

/* -- Queries ------------------------------------------------- */

export async function getSubjectById(id: string): Promise<Subject | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, id))
    .limit(1);
  return rows.at(0) ?? null;
}

export async function getSubjectByCode(code: string): Promise<Subject | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, code))
    .limit(1);
  return rows.at(0) ?? null;
}

export async function listSubjects(): Promise<Subject[]> {
  const db = await getDb();
  return db.select().from(subjects).orderBy(subjects.name);
}
