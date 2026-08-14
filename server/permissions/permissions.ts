/**
 * §4.2 / §9.3 — RBAC permission matrix.
 *
 * Each permission is a fine-grained action. Roles are granted a set of
 * permissions. Contextual checks (e.g. "is this user a member of class X?")
 * are handled separately in `context.ts`.
 */

import type { UserRole } from "@/types";

/* ── Permissions (fine-grained actions) ────────────────────── */

export const PERMISSIONS = [
  // Content
  "content:view:public",
  "content:view:school",
  "content:view:class",
  "content:create",
  "content:edit:own",
  "content:edit:any",
  "content:delete:own",
  "content:delete:any",
  "content:publish",
  "content:moderate",
  "content:download",

  // Assignments
  "assignment:create",
  "assignment:edit:own",
  "assignment:delete:own",
  "assignment:submit",
  "assignment:grade",
  "assignment:view:grades",

  // Quiz
  "quiz:create",
  "quiz:edit:own",
  "quiz:delete:own",
  "quiz:take",
  "quiz:view:results",

  // Competitions
  "competition:create",
  "competition:participate",
  "competition:view:rankings",

  // Classes & schools
  "school:create",
  "school:manage:members",
  "school:manage:classes",
  "school:manage:billing",
  "class:create",
  "class:manage:members",
  "class:view",

  // Messaging
  "message:send:teacher_student",
  "message:send:school_parent",
  "message:send:student_tutor",
  "announcement:publish:class",
  "announcement:publish:school",

  // Parent
  "parent:view:child",
  "parent:pay",
  "parent:book:tutor",

  // Tutoring
  "tutor:profile:manage",
  "tutor:booking:manage",
  "tutor:view:earnings",

  // Admin
  "admin:users:manage",
  "admin:schools:manage",
  "admin:contents:manage",
  "admin:payments:manage",
  "admin:moderation",
  "admin:feature_flags",
  "admin:audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/* ── Role → permissions mapping (§4.2) ─────────────────────── */

const ALL_CONTENT_VIEW = [
  "content:view:public",
  "content:download",
] as const;

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  student: new Set<Permission>([
    ...ALL_CONTENT_VIEW,
    "content:view:class",
    "content:view:school",
    "assignment:submit",
    "quiz:take",
    "quiz:view:results",
    "competition:participate",
    "competition:view:rankings",
    "class:view",
    "message:send:student_tutor",
    "parent:book:tutor",
  ]),

  teacher: new Set<Permission>([
    ...ALL_CONTENT_VIEW,
    "content:view:class",
    "content:view:school",
    "content:create",
    "content:edit:own",
    "content:delete:own",
    "content:publish",
    "content:download",
    "assignment:create",
    "assignment:edit:own",
    "assignment:delete:own",
    "assignment:grade",
    "assignment:view:grades",
    "quiz:create",
    "quiz:edit:own",
    "quiz:delete:own",
    "quiz:view:results",
    "competition:create",
    "competition:view:rankings",
    "class:create",
    "class:manage:members",
    "class:view",
    "message:send:teacher_student",
    "announcement:publish:class",
  ]),

  school_admin: new Set<Permission>([
    ...ALL_CONTENT_VIEW,
    "content:view:school",
    "content:create",
    "content:edit:own",
    "content:delete:own",
    "content:publish",
    "content:download",
    "assignment:create",
    "assignment:grade",
    "assignment:view:grades",
    "competition:create",
    "class:create",
    "class:manage:members",
    "class:view",
    "school:manage:members",
    "school:manage:classes",
    "school:manage:billing",
    "message:send:school_parent",
    "announcement:publish:school",
  ]),

  parent: new Set<Permission>([
    ...ALL_CONTENT_VIEW,
    "parent:view:child",
    "parent:pay",
    "parent:book:tutor",
    "message:send:school_parent",
    "competition:view:rankings",
  ]),

  tutor: new Set<Permission>([
    ...ALL_CONTENT_VIEW,
    "tutor:profile:manage",
    "tutor:booking:manage",
    "tutor:view:earnings",
    "message:send:student_tutor",
    "competition:view:rankings",
  ]),

  platform_admin: new Set<Permission>(PERMISSIONS),

  content_moderator: new Set<Permission>([
    "content:view:public",
    "content:view:school",
    "content:view:class",
    "content:moderate",
    "content:delete:any",
    "content:edit:any",
    "admin:moderation",
  ]),

  support: new Set<Permission>([
    "content:view:public",
    "admin:users:manage",
    "message:send:teacher_student",
    "message:send:school_parent",
    "message:send:student_tutor",
  ]),
};

/* ── Public API ────────────────────────────────────────────── */

/**
 * Returns true if the given role has the requested permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Returns true if the role has ALL of the requested permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  const granted = ROLE_PERMISSIONS[role];
  if (!granted) return false;
  return permissions.every((p) => granted.has(p));
}

/**
 * Returns true if the role has ANY of the requested permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  const granted = ROLE_PERMISSIONS[role];
  if (!granted) return false;
  return permissions.some((p) => granted.has(p));
}

/**
 * Lists all permissions for a role (for debugging / UI display).
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}
