/**
 * §10.3 — Schools, classes & academic structure.
 *
 * - schools (educational institutions, mirrored with Clerk organizations)
 * - school_members (user ↔ school membership + role/status)
 * - classes (a class within a school, e.g. "Terminale D - 2025")
 * - class_members (student / teacher / parent enrollment)
 * - subjects (catalog of subjects: Maths, Physique, SVT…)
 * - class_subjects (subject taught in a class with coefficient & teacher)
 * - parent_student_relations (links parents to students)
 */
import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  boolean,
  integer as pgInteger,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { pgRef, sqliteRef } from "./_env";
import { users } from "./users";
import {
  levelEnum,
  seriesEnum,
  roleInSchoolEnum,
  memberStatusEnum,
  schoolTypeEnum,
  invitationStatusEnum,
  joinRequestStatusEnum,
  invitationTargetEnum,
} from "./enums";

/* ─────────────────────────────────────────────────────────────
 * schools
 * ──────────────────────────────────────────────────────────── */

export const schools = pgTable(
  "schools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Optional link to a Clerk Organization (SSO). */
    clerkOrgId: pgText("clerk_org_id"),
    name: pgText("name").notNull(),
    slug: pgText("slug").notNull().unique(),
    type: schoolTypeEnum("type"),
    city: pgText("city"),
    region: pgText("region"),
    logoUrl: pgText("logo_url"),
    isVerified: boolean("is_verified").default(false).notNull(),
    contactEmail: pgText("contact_email"),
    contactPhone: pgText("contact_phone"),
    /**
     * Short 6-8 character code students/teachers can enter to join
     * the school without an email invitation. Generated at creation
     * time and shown in the school dashboard.
     */
    joinCode: pgText("join_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    slugIdx: pgUniqueIndex("schools_slug_uniq").on(t.slug),
    typeIdx: pgIndex("schools_type_idx").on(t.type),
    cityIdx: pgIndex("schools_city_idx").on(t.city),
    joinCodeIdx: pgIndex("schools_join_code_idx").on(t.joinCode),
  }),
);

export type School = typeof schools.$inferSelect;
export type NewSchool = typeof schools.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * school_members
 * ──────────────────────────────────────────────────────────── */

export const schoolMembers = pgTable(
  "school_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => pgRef(schools.id), { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    roleInSchool: roleInSchoolEnum("role_in_school").notNull(),
    status: memberStatusEnum("status").notNull().default("pending"),
    invitedBy: uuid("invited_by"),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    schoolUserIdx: pgUniqueIndex("school_members_school_user_uniq").on(
      t.schoolId,
      t.userId,
    ),
    userIdx: pgIndex("school_members_user_id_idx").on(t.userId),
    statusIdx: pgIndex("school_members_status_idx").on(t.status),
  }),
);

export type SchoolMember = typeof schoolMembers.$inferSelect;
export type NewSchoolMember = typeof schoolMembers.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * classes
 * ──────────────────────────────────────────────────────────── */

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => pgRef(schools.id), { onDelete: "cascade" }),
    name: pgText("name").notNull(),
    level: levelEnum("level"),
    series: seriesEnum("series"),
    /** e.g. "2025-2026". */
    academicYear: pgText("academic_year"),
    headTeacherId: uuid("head_teacher_id").references(() => pgRef(users.id), {
      onDelete: "set null",
    }),
    /** Short code students enter to self-enroll. */
    inviteCode: pgText("invite_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    schoolIdx: pgIndex("classes_school_id_idx").on(t.schoolId),
    levelIdx: pgIndex("classes_level_idx").on(t.level),
    inviteIdx: pgIndex("classes_invite_code_idx").on(t.inviteCode),
  }),
);

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * class_members
 * ──────────────────────────────────────────────────────────── */

export const classMembers = pgTable(
  "class_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => pgRef(classes.id), { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    role: roleInSchoolEnum("role").notNull().default("student"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    classUserIdx: pgUniqueIndex("class_members_class_user_uniq").on(
      t.classId,
      t.userId,
    ),
    userIdx: pgIndex("class_members_user_id_idx").on(t.userId),
  }),
);

export type ClassMember = typeof classMembers.$inferSelect;
export type NewClassMember = typeof classMembers.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * subjects — global catalog
 * ──────────────────────────────────────────────────────────── */

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: pgText("name").notNull(),
    /** e.g. "MATHS", "PC", "SVT". */
    code: pgText("code").notNull().unique(),
    description: pgText("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    codeIdx: pgUniqueIndex("subjects_code_uniq").on(t.code),
  }),
);

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * class_subjects — subject taught in a class with coefficient
 * ──────────────────────────────────────────────────────────── */

export const classSubjects = pgTable(
  "class_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => pgRef(classes.id), { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => pgRef(subjects.id), { onDelete: "restrict" }),
    coefficient: pgInteger("coefficient").default(1).notNull(),
    teacherId: uuid("teacher_id").references(() => pgRef(users.id), {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    classSubjectIdx: pgUniqueIndex("class_subjects_class_subject_uniq").on(
      t.classId,
      t.subjectId,
    ),
    teacherIdx: pgIndex("class_subjects_teacher_id_idx").on(t.teacherId),
  }),
);

export type ClassSubject = typeof classSubjects.$inferSelect;
export type NewClassSubject = typeof classSubjects.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * parent_student_relations
 * ──────────────────────────────────────────────────────────── */

export const parentStudentRelations = pgTable(
  "parent_student_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** e.g. "parent", "guardian", "sibling". */
    relationship: pgText("relationship").notNull().default("parent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    parentStudentIdx: pgUniqueIndex("parent_student_relations_uniq").on(
      t.parentId,
      t.studentId,
    ),
    studentIdx: pgIndex("parent_student_relations_student_id_idx").on(
      t.studentId,
    ),
  }),
);

export type ParentStudentRelation = typeof parentStudentRelations.$inferSelect;
export type NewParentStudentRelation =
  typeof parentStudentRelations.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * invitations — In-app invitations sent by school admin / teacher
 *
 * Replaces the email-only flow. The invitation is created in DB
 * (status=pending), an in-app notification is created, AND an email
 * is sent (best-effort). The recipient can accept/reject from the app.
 * ──────────────────────────────────────────────────────────── */

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** "school" or "class". */
    targetType: invitationTargetEnum("target_type").notNull(),
    /** FK to schools.id or classes.id depending on targetType. */
    targetId: uuid("target_id").notNull(),
    /** The user being invited (null if invited by email not yet registered). */
    inviteeUserId: uuid("invitee_user_id").references(() => pgRef(users.id), {
      onDelete: "cascade",
    }),
    /** Email used when the user doesn't have an account yet. */
    inviteeEmail: pgText("invitee_email"),
    /** Role the invitee will have in the school/class. */
    roleInTarget: roleInSchoolEnum("role_in_target").notNull(),
    /** The user who sent the invitation. */
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Optional personal message. */
    message: pgText("message"),
    status: invitationStatusEnum("status").notNull().default("pending"),
    /** When the invitation was accepted/rejected. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Auto-expire after 7 days if not accepted. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    inviteeIdx: pgIndex("invitations_invitee_user_id_idx").on(t.inviteeUserId),
    inviteeEmailIdx: pgIndex("invitations_invitee_email_idx").on(t.inviteeEmail),
    targetIdx: pgIndex("invitations_target_idx").on(t.targetType, t.targetId),
    statusIdx: pgIndex("invitations_status_idx").on(t.status),
  }),
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * school_join_requests — Requests from users to join a school
 *
 * Initiated by students/teachers who want to join a school by code
 * or by browsing. School admin can approve/reject.
 * ──────────────────────────────────────────────────────────── */

export const schoolJoinRequests = pgTable(
  "school_join_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => pgRef(schools.id), { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    roleInSchool: roleInSchoolEnum("role_in_school").notNull(),
    /** Optional message from the requester. */
    message: pgText("message"),
    status: joinRequestStatusEnum("status").notNull().default("pending"),
    /** User who approved/rejected (school admin). */
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Optional admin note when rejecting. */
    adminNote: pgText("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    schoolIdx: pgIndex("school_join_requests_school_id_idx").on(t.schoolId),
    userIdx: pgIndex("school_join_requests_user_id_idx").on(t.userId),
    statusIdx: pgIndex("school_join_requests_status_idx").on(t.status),
    schoolUserUniq: pgUniqueIndex("school_join_requests_school_user_uniq").on(
      t.schoolId,
      t.userId,
    ),
  }),
);

export type SchoolJoinRequest = typeof schoolJoinRequests.$inferSelect;
export type NewSchoolJoinRequest = typeof schoolJoinRequests.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * class_join_requests — Requests from users to join a class
 *
 * Same pattern as school_join_requests but for a class.
 * ──────────────────────────────────────────────────────────── */

export const classJoinRequests = pgTable(
  "class_join_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => pgRef(classes.id), { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    role: roleInSchoolEnum("role").notNull().default("student"),
    message: pgText("message"),
    status: joinRequestStatusEnum("status").notNull().default("pending"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    adminNote: pgText("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    classIdx: pgIndex("class_join_requests_class_id_idx").on(t.classId),
    userIdx: pgIndex("class_join_requests_user_id_idx").on(t.userId),
    statusIdx: pgIndex("class_join_requests_status_idx").on(t.status),
    classUserUniq: pgUniqueIndex("class_join_requests_class_user_uniq").on(
      t.classId,
      t.userId,
    ),
  }),
);

export type ClassJoinRequest = typeof classJoinRequests.$inferSelect;
export type NewClassJoinRequest = typeof classJoinRequests.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * school_access_codes — Access codes for school admin to invite
 *                       other school_admins to co-manage the school
 * ──────────────────────────────────────────────────────────── */

export const schoolAccessCodes = pgTable(
  "school_access_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => pgRef(schools.id), { onDelete: "cascade" }),
    /** The access code string (8-12 chars, uppercase alphanumeric). */
    accessCode: pgText("access_code").notNull(),
    /** Who created this code (the school creator/admin). */
    createdBy: uuid("created_by")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Number of times this code has been used. */
    usages: pgInteger("usages").default(0).notNull(),
    /** Max usages allowed (null = unlimited). */
    maxUsages: pgInteger("max_usages"),
    /** When the code expires (null = never). */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    schoolIdx: pgIndex("school_access_codes_school_id_idx").on(t.schoolId),
    codeIdx: pgUniqueIndex("school_access_codes_code_uniq").on(t.accessCode),
  }),
);

export type SchoolAccessCode = typeof schoolAccessCodes.$inferSelect;
export type NewSchoolAccessCode = typeof schoolAccessCodes.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * school_admin_access — Access requests from school_admins to
 *                       join the management of an existing school
 * ──────────────────────────────────────────────────────────── */

export const schoolAdminAccess = pgTable(
  "school_admin_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => pgRef(schools.id), { onDelete: "cascade" }),
    /** The school_admin requesting access. */
    schoolAdminId: uuid("school_admin_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** The access code used (for audit trail). */
    schoolAccessCodeId: uuid("school_access_code_id")
      .notNull()
      .references(() => pgRef(schoolAccessCodes.id), { onDelete: "cascade" }),
    status: joinRequestStatusEnum("status").notNull().default("pending"),
    /** Who approved/rejected (the school creator). */
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    adminNote: pgText("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    schoolIdx: pgIndex("school_admin_access_school_id_idx").on(t.schoolId),
    adminIdx: pgIndex("school_admin_access_school_admin_id_idx").on(t.schoolAdminId),
    statusIdx: pgIndex("school_admin_access_status_idx").on(t.status),
    schoolAdminUniq: pgUniqueIndex("school_admin_access_school_admin_uniq").on(
      t.schoolId,
      t.schoolAdminId,
    ),
  }),
);

export type SchoolAdminAccess = typeof schoolAdminAccess.$inferSelect;
export type NewSchoolAdminAccess = typeof schoolAdminAccess.$inferInsert;
