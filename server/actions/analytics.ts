"use server";

/**
 * §5.9 + §5.10 — Analytics server actions.
 *
 * Wraps the analytics service with auth + RBAC checks. Each action returns
 * a typed ApiResponse<T>. Server Components / pages can call these actions
 * directly to fetch aggregated analytics data.
 */

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isSchoolMember } from "@/server/permissions";
import { requireRole } from "@/server/permissions/context";
import * as analyticsService from "@/server/services/analytics";
import type {
  PlatformOverview,
  PlatformTopSchool,
  PlatformTopContent,
  RoleDistributionEntry,
  SchoolOverview,
  SchoolTopContent,
  SchoolUsageStat,
  TeacherClassStat,
  TeacherAssignmentStat,
  TeacherOverview,
  TeacherStudentNeedingAttention,
  TimelinePoint,
  StreakDay,
  StudentProgress,
  StudentSubjectStat,
  StudentQuizHistoryItem,
  StudentAssignmentHistoryItem,
} from "@/server/services/analytics";
import { getSchoolForAdminUser } from "../services/schools";

/* ── Student analytics ──────────────────────────────────────── */

export async function getStudentProgressAction(): Promise<
  ApiResponse<StudentProgress>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "student", "parent", "platform_admin");
    const data = await analyticsService.getStudentProgress(dbUser.id);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getStudentProgressAction");
  }
}

export async function getStudentSubjectStatsAction(): Promise<
  ApiResponse<StudentSubjectStat[]>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "student", "parent", "platform_admin");
    const data = await analyticsService.getStudentSubjectStats(dbUser.id);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getStudentSubjectStatsAction");
  }
}

export async function getStudentQuizHistoryAction(
  limit = 10,
): Promise<ApiResponse<StudentQuizHistoryItem[]>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "student", "parent", "platform_admin");
    const data = await analyticsService.getStudentQuizHistory(dbUser.id, limit);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getStudentQuizHistoryAction");
  }
}

export async function getStudentAssignmentHistoryAction(
  limit = 10,
): Promise<ApiResponse<StudentAssignmentHistoryItem[]>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "student", "parent", "platform_admin");
    const data = await analyticsService.getStudentAssignmentHistory(
      dbUser.id,
      limit,
    );
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getStudentAssignmentHistoryAction");
  }
}

export async function getStudentActivityTimelineAction(
  days = 30,
): Promise<ApiResponse<TimelinePoint[]>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "student", "parent", "platform_admin");
    const data = await analyticsService.getStudentActivityTimeline(
      dbUser.id,
      days,
    );
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getStudentActivityTimelineAction");
  }
}

export async function getStudentStreakCalendarAction(
  days = 84,
): Promise<ApiResponse<StreakDay[]>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "student", "parent", "platform_admin");
    const data = await analyticsService.getStudentStreakCalendar(
      dbUser.id,
      days,
    );
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getStudentStreakCalendarAction");
  }
}

/* ── Teacher analytics ─────────────────────────────────────── */

export async function getTeacherOverviewAction(): Promise<
  ApiResponse<TeacherOverview>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "teacher", "platform_admin");
    const data = await analyticsService.getTeacherOverview(dbUser.id);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getTeacherOverviewAction");
  }
}

export async function getTeacherClassStatsAction(): Promise<
  ApiResponse<TeacherClassStat[]>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "teacher", "platform_admin");
    const data = await analyticsService.getTeacherClassStats(dbUser.id);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getTeacherClassStatsAction");
  }
}

export async function getTeacherAssignmentStatsAction(): Promise<
  ApiResponse<TeacherAssignmentStat[]>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "teacher", "platform_admin");
    const data = await analyticsService.getTeacherAssignmentStats(dbUser.id);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getTeacherAssignmentStatsAction");
  }
}

export async function getTeacherStudentPerformanceAction(): Promise<
  ApiResponse<TeacherStudentNeedingAttention[]>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "teacher", "platform_admin");
    const data = await analyticsService.getTeacherStudentPerformance(dbUser.id);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getTeacherStudentPerformanceAction");
  }
}

/* ── School analytics ──────────────────────────────────────── */

async function requireSchoolContext(schoolId: string): Promise<void> {
  const dbUser = await requireDbUserOrThrow();
  if (dbUser.role === "platform_admin") return;
  requireRole(dbUser.role, "school_admin", "teacher");
  const isMember = await isSchoolMember(dbUser.id, schoolId);
  if (!isMember) {
    throw AppError.forbidden("You are not a member of this school");
  }
}

export async function getSchoolOverviewAction(
  schoolId: string,
): Promise<ApiResponse<SchoolOverview>> {
  try {
    await requireSession();
    await requireSchoolContext(schoolId);
    const data = await analyticsService.getSchoolOverview(schoolId);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getSchoolOverviewAction");
  }
}

export async function getSchoolEngagementAction(
  schoolId: string,
  days = 30,
): Promise<ApiResponse<TimelinePoint[]>> {
  try {
    await requireSession();
    await requireSchoolContext(schoolId);
    const data = await analyticsService.getSchoolEngagement(schoolId, days);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getSchoolEngagementAction");
  }
}

export async function getSchoolTopContentsAction(
  schoolId: string,
  limit = 5,
): Promise<ApiResponse<SchoolTopContent[]>> {
  try {
    await requireSession();
    await requireSchoolContext(schoolId);
    const data = await analyticsService.getSchoolTopContents(schoolId, limit);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getSchoolTopContentsAction");
  }
}

export async function getSchoolClassComparisonAction(
  schoolId: string,
): Promise<ApiResponse<TeacherClassStat[]>> {
  try {
    await requireSession();
    await requireSchoolContext(schoolId);
    const data = await analyticsService.getSchoolClassComparison(schoolId);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getSchoolClassComparisonAction");
  }
}

export async function getSchoolUsageStatsAction(
  schoolId: string,
): Promise<ApiResponse<SchoolUsageStat>> {
  try {
    await requireSession();
    await requireSchoolContext(schoolId);
    const data = await analyticsService.getSchoolUsageStats(schoolId);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getSchoolUsageStatsAction");
  }
}

/**
 * Convenience action: returns analytics for the school the current user administers.
 * Returns null if the user has no school.
 */
export async function getMySchoolAnalyticsAction(): Promise<
  ApiResponse<{ schoolId: string } | null>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "school_admin", "platform_admin");
    const school = await getSchoolForAdminUser(dbUser.id);
    if (!school) return { success: true, data: null };
    return { success: true, data: { schoolId: school.id } };
  } catch (err) {
    return handleErr(err, "getMySchoolAnalyticsAction");
  }
}

/* ── Platform analytics (admin) ────────────────────────────── */

export async function getPlatformOverviewAction(): Promise<
  ApiResponse<PlatformOverview>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "platform_admin", "content_moderator", "support");
    const data = await analyticsService.getPlatformOverview();
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getPlatformOverviewAction");
  }
}

export async function getPlatformGrowthAction(
  days = 30,
): Promise<ApiResponse<TimelinePoint[]>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "platform_admin", "content_moderator", "support");
    const data = await analyticsService.getPlatformGrowth(days);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getPlatformGrowthAction");
  }
}

export async function getPlatformRoleDistributionAction(): Promise<
  ApiResponse<RoleDistributionEntry[]>
> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "platform_admin", "content_moderator", "support");
    const data = await analyticsService.getPlatformRoleDistribution();
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getPlatformRoleDistributionAction");
  }
}

export async function getPlatformTopSchoolsAction(
  limit = 5,
): Promise<ApiResponse<PlatformTopSchool[]>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "platform_admin", "content_moderator", "support");
    const data = await analyticsService.getPlatformTopSchools(limit);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getPlatformTopSchoolsAction");
  }
}

export async function getPlatformTopContentsAction(
  limit = 5,
): Promise<ApiResponse<PlatformTopContent[]>> {
  try {
    const dbUser = await requireDbUserOrThrow();
    requireRole(dbUser.role, "platform_admin", "content_moderator", "support");
    const data = await analyticsService.getPlatformTopContents(limit);
    return { success: true, data };
  } catch (err) {
    return handleErr(err, "getPlatformTopContentsAction");
  }
}

/* ── Helpers ─────────────────────────────────────────────────── */

async function requireDbUserOrThrow() {
  await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    throw AppError.notFound(
      "User profile not found. Please complete onboarding.",
    );
  }
  return dbUser;
}

function handleErr(err: unknown, label: string): ApiResponse<never> {
  if (err instanceof AppError) {
    return { success: false, error: { code: err.code, message: err.message } };
  }
  logger.error(`${label} failed`, { error: String(err) });
  return {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Could not load analytics data",
    },
  };
}
