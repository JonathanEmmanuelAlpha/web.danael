"use server";

/**
 * §5.12 — Notifications server actions.
 *
 * Wraps the notifications service with auth + permission checks.
 * Each action returns a typed ApiResponse<T>.
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  listNotificationsQuerySchema,
  updateNotificationPreferencesSchema,
  type ListNotificationsQuery,
  type UpdateNotificationPreferencesInput,
} from "@/server/validators/notifications";
import * as notificationsService from "@/server/services/notifications";
import type {
  Notification,
  NotificationListResult,
  NotificationPreferencesShape,
} from "@/server/services/notifications";

/* ── Actions ──────────────────────────────────────────────── */

export async function listNotificationsAction(
  query?: Partial<ListNotificationsQuery>,
): Promise<ApiResponse<NotificationListResult>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = listNotificationsQuerySchema.safeParse({
      type: query?.type,
      read: query?.read,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    });
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const result = await notificationsService.listNotifications(
      dbUser.id,
      parsed.data,
    );
    logger.debug("listNotificationsAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      count: result.items.length,
    });
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listNotificationsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list notifications" },
    };
  }
}

export async function markAsReadAction(
  notificationId: string,
): Promise<ApiResponse<Notification>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const updated = await notificationsService.markAsRead(
      notificationId,
      dbUser.id,
    );
    logger.debug("markAsReadAction", {
      notificationId,
      userId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/notifications");
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("markAsReadAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not mark as read" },
    };
  }
}

export async function markAllAsReadAction(): Promise<
  ApiResponse<{ updated: number }>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await notificationsService.markAllAsRead(dbUser.id);
    logger.info("markAllAsReadAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      updated: result.updated,
    });
    revalidatePath("/notifications");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("markAllAsReadAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not mark all as read" },
    };
  }
}

export async function deleteNotificationAction(
  notificationId: string,
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await notificationsService.deleteNotification(
      notificationId,
      dbUser.id,
    );
    logger.info("deleteNotificationAction", {
      notificationId,
      userId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/notifications");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("deleteNotificationAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not delete notification" },
    };
  }
}

export async function getUnreadCountAction(): Promise<
  ApiResponse<{ count: number }>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const count = await notificationsService.getUnreadCount(dbUser.id);
    logger.debug("getUnreadCountAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
      count,
    });
    return { success: true, data: { count } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getUnreadCountAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not get unread count" },
    };
  }
}

/* ── Preferences ─────────────────────────────────────────── */

export async function getPreferencesAction(): Promise<
  ApiResponse<NotificationPreferencesShape>
> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const prefs = await notificationsService.getNotificationPreferences(
      dbUser.id,
    );
    logger.debug("getPreferencesAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
    });
    return { success: true, data: prefs };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("getPreferencesAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not load notification preferences",
      },
    };
  }
}

export async function updatePreferencesAction(
  input: UpdateNotificationPreferencesInput,
): Promise<ApiResponse<NotificationPreferencesShape>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = updateNotificationPreferencesSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const prefs = await notificationsService.updateNotificationPreferences(
      dbUser.id,
      parsed.data,
    );
    logger.info("updatePreferencesAction", {
      userId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/notifications");
    return { success: true, data: prefs };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("updatePreferencesAction failed", { error: String(err) });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Could not update notification preferences",
      },
    };
  }
}
