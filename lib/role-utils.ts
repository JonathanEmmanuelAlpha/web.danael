/**
 * Role badge variant mapping (shared client + server safe).
 *
 * Returns the shadcn Badge variant that best matches a given user role.
 */

import type { UserRole } from "@/types";

type BadgeVariant =
  | "default"
  | "brand"
  | "success"
  | "warning"
  | "info"
  | "secondary"
  | "destructive"
  | "outline";

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = {
  student: "brand",
  teacher: "info",
  school_admin: "success",
  parent: "info",
  tutor: "warning",
  platform_admin: "destructive",
  content_moderator: "warning",
  support: "secondary",
};

export function roleBadgeVariant(role: UserRole): BadgeVariant {
  return ROLE_VARIANT[role] ?? "secondary";
}
