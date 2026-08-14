import { UserRole } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUserDashboardRoadByRole(role: UserRole) {
  const NATIVES = ["parent", "student", "teacher", "tutor"];
  const ADMINS = ["platform_admin", "content_moderator", "support"];

  if (NATIVES.includes(role)) return `/${role}/dashboard`;
  if (ADMINS.includes(role)) return `/admin/dashboard`;

  return `/school/dashboard`;
}
