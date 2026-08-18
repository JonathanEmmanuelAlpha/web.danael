/**
 * §5.3 — Subject service (business logic).
 */

import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db";
import { classSubjects, subjects, subjectSkills } from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  AssignSubjectInput,
  UpdateClassSubjectInput,
  CreateSubjectSkillInput,
  UpdateSubjectSkillInput,
  ListSubjectSkillsInput,
} from "@/server/validators/subjects";
import type {
  Subject,
  ClassSubject,
  SubjectSkill,
} from "@/server/db/schema/schools";
import type { User } from "@/server/db/schema/users";

/* -- Types --------------------------------------------------- */

export type ClassSubjectWithRelations = ClassSubject & {
  subject: Subject;
  teacher: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl"
  > | null;
};

export type SubjectWithSkills = Subject & {
  skills: SubjectSkill[];
  skillsCount: number;
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

/* -- Subject skills ------------------------------------------- */

/**
 * List skills attached to a subject, optionally including inactive ones.
 */
export async function listSubjectSkills(
  input: ListSubjectSkillsInput,
): Promise<SubjectSkill[]> {
  const db = await getDb();
  const conditions = [eq(subjectSkills.subjectId, input.subjectId)];
  if (!input.includeInactive) {
    conditions.push(eq(subjectSkills.isActive, true));
  }
  return db
    .select()
    .from(subjectSkills)
    .where(and(...conditions))
    .orderBy(asc(subjectSkills.position), asc(subjectSkills.name));
}

/**
 * Get a single subject skill by id.
 */
export async function getSubjectSkillById(
  id: string,
): Promise<SubjectSkill | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subjectSkills)
    .where(eq(subjectSkills.id, id))
    .limit(1);
  return rows.at(0) ?? null;
}

/**
 * Create a new skill on a subject. Enforces uniqueness within subject.
 */
export async function createSubjectSkill(
  input: CreateSubjectSkillInput,
): Promise<SubjectSkill> {
  const db = await getDb();

  // Verify the subject exists.
  const subject = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.id, input.subjectId))
    .limit(1);
  if (subject.length === 0) {
    throw AppError.notFound("Subject not found");
  }

  // Prevent duplicate name within the same subject.
  const existing = await db
    .select({ id: subjectSkills.id })
    .from(subjectSkills)
    .where(
      and(
        eq(subjectSkills.subjectId, input.subjectId),
        eq(subjectSkills.name, input.name),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    throw AppError.conflict("A skill with this name already exists on the subject");
  }

  // Compute next position automatically if not provided.
  let position = input.position;
  if (position === undefined) {
    const all = await db
      .select({ position: subjectSkills.position })
      .from(subjectSkills)
      .where(eq(subjectSkills.subjectId, input.subjectId));
    position = all.length;
  }

  const [created] = await db
    .insert(subjectSkills)
    .values({
      subjectId: input.subjectId,
      name: input.name,
      description: input.description,
      difficulty: input.difficulty,
      slug: input.slug,
      icon: input.icon,
      color: input.color,
      skillNodeId: input.skillNodeId,
      position,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create subject skill");
  return created;
}

/**
 * Update an existing skill.
 */
export async function updateSubjectSkill(
  id: string,
  input: UpdateSubjectSkillInput,
): Promise<SubjectSkill> {
  const db = await getDb();
  const [updated] = await db
    .update(subjectSkills)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description ?? null }
        : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.icon !== undefined ? { icon: input.icon ?? null } : {}),
      ...(input.color !== undefined ? { color: input.color ?? null } : {}),
      ...(input.skillNodeId !== undefined
        ? { skillNodeId: input.skillNodeId ?? null }
        : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(subjectSkills.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Subject skill not found");
  return updated;
}

/**
 * Delete a skill permanently. The FK columns on contents/assignments/etc.
 * are ON DELETE SET NULL, so existing resources keep their data but lose
 * the skill reference.
 */
export async function deleteSubjectSkill(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(subjectSkills).where(eq(subjectSkills.id, id));
}

/**
 * Bulk-fetch skills by their ids (used by content / assignment / quiz
 * detail views to display the associated skill badge).
 */
export async function getSubjectSkillsByIds(
  ids: string[],
): Promise<SubjectSkill[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db
    .select()
    .from(subjectSkills)
    .where(inArray(subjectSkills.id, ids))
    .orderBy(asc(subjectSkills.name));
}

/**
 * List all subjects with their skills attached (single query that
 * aggregates skills per subject). Used by the admin subjects manager.
 */
export async function listSubjectsWithSkills(): Promise<SubjectWithSkills[]> {
  const db = await getDb();
  const allSubjects = await db
    .select()
    .from(subjects)
    .orderBy(asc(subjects.name));
  if (allSubjects.length === 0) return [];

  const subjectIds = allSubjects.map((s) => s.id);
  const allSkills = await db
    .select()
    .from(subjectSkills)
    .where(inArray(subjectSkills.subjectId, subjectIds))
    .orderBy(asc(subjectSkills.position), asc(subjectSkills.name));

  const skillsBySubject = new Map<string, SubjectSkill[]>();
  for (const skill of allSkills) {
    const list = skillsBySubject.get(skill.subjectId) ?? [];
    list.push(skill);
    skillsBySubject.set(skill.subjectId, list);
  }

  return allSubjects.map((subject) => {
    const skills = skillsBySubject.get(subject.id) ?? [];
    return { ...subject, skills, skillsCount: skills.length };
  });
}
