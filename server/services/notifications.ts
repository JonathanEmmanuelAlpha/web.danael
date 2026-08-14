/**
 * §5.12 — Notifications service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 *
 * Responsibilities:
 *  - createNotification (+ live SSE push)
 *  - listNotifications (paginated, filterable by type / read state)
 *  - markAsRead / markAllAsRead
 *  - deleteNotification
 *  - getUnreadCount
 *  - getNotificationPreferences / updateNotificationPreferences
 */

import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { getDb } from "@/server/db";
import { notifications, notificationPreferences } from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type {
  CreateNotificationInput,
  ListNotificationsQuery,
  UpdateNotificationPreferencesInput,
} from "@/server/validators/notifications";
import type { Notification } from "@/server/db/schema/messaging";
import type { NotificationPreferences } from "@/server/db/schema/messaging";

/* ── Types ─────────────────────────────────────────────────── */

export type { Notification, NotificationPreferences };

export type NotificationListResult = {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
};

export type NotificationPreferencesShape = {
  channels: string[];
  frequency: string;
  categories: string[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

/* ── Mutations ─────────────────────────────────────────────── */

/**
 * Create a notification for `userId` and push it live to SSE subscribers.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const db = await getDb();

  const [created] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata: (input.metadata as Record<string, unknown> | null) ?? null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create notification");

  // Best-effort live push to SSE subscribers.
  notifyLive(input.userId, {
    id: created.id,
    userId: created.userId,
    type: created.type,
    title: created.title,
    body: created.body,
    link: created.link,
    metadata: created.metadata,
    readAt: created.readAt,
    createdAt: created.createdAt,
  }).catch(() => {
    /* swallow */
  });

  return created;
}

/**
 * List notifications for the user, optionally filtered by type or read state.
 */
export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery,
): Promise<NotificationListResult> {
  const db = await getDb();

  const conds = [
    eq(notifications.userId, userId),
    query.type ? eq(notifications.type, query.type) : undefined,
    query.read === "unread"
      ? isNull(notifications.readAt)
      : query.read === "read"
        ? isNotNull(notifications.readAt)
        : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...(conds as ReturnType<typeof eq>[])))
    .orderBy(desc(notifications.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const totalRow = await db
    .select({ c: count() })
    .from(notifications)
    .where(and(...(conds as ReturnType<typeof eq>[])));

  return {
    items: rows,
    total: totalRow.at(0)?.c ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<Notification> {
  const db = await getDb();

  // Verify ownership.
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  const notif = rows.at(0);
  if (!notif) throw AppError.notFound("Notification not found");
  if (notif.userId !== userId) {
    throw AppError.forbidden("You can only manage your own notifications");
  }

  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.id, notificationId))
    .returning();
  if (!updated) throw AppError.internal("Failed to mark notification as read");
  return updated;
}

/**
 * Mark all unread notifications for the user as read.
 */
export async function markAllAsRead(
  userId: string,
): Promise<{ updated: number }> {
  const db = await getDb();
  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning();
  return { updated: result.length };
}

/**
 * Delete a notification.
 */
export async function deleteNotification(
  notificationId: string,
  userId: string,
): Promise<{ deleted: boolean }> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  const notif = rows.at(0);
  if (!notif) throw AppError.notFound("Notification not found");
  if (notif.userId !== userId) {
    throw AppError.forbidden("You can only manage your own notifications");
  }
  await db.delete(notifications).where(eq(notifications.id, notificationId));
  return { deleted: true };
}

/**
 * Total unread count for the user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ c: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows.at(0)?.c ?? 0;
}

/* ── Preferences ─────────────────────────────────────────── */

/**
 * Returns the user's notification preferences (creating a default row if none exists).
 */
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferencesShape> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  const existing = rows.at(0);
  if (existing) {
    return {
      channels: existing.channels,
      frequency: existing.frequency,
      categories: existing.categories,
      quietHoursStart: existing.quietHoursStart,
      quietHoursEnd: existing.quietHoursEnd,
    };
  }

  // No row yet — create with defaults.
  const [created] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      channels: ["in_app", "email"],
      frequency: "immediate",
      categories: [
        "assignments",
        "grades",
        "announcements",
        "messages",
        "reminders",
        "social",
        "system",
        "billing",
      ],
      quietHoursStart: null,
      quietHoursEnd: null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create preferences");

  return {
    channels: created.channels,
    frequency: created.frequency,
    categories: created.categories,
    quietHoursStart: created.quietHoursStart,
    quietHoursEnd: created.quietHoursEnd,
  };
}

/**
 * Update the user's notification preferences (upsert).
 */
export async function updateNotificationPreferences(
  userId: string,
  input: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferencesShape> {
  const db = await getDb();

  // Look up existing first.
  const existingRows = await db
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  const existingId = existingRows.at(0)?.id;

  if (existingId) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        channels: input.channels,
        frequency: input.frequency,
        categories: input.categories,
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.id, existingId))
      .returning();
    if (!updated) throw AppError.internal("Failed to update preferences");
    return {
      channels: updated.channels,
      frequency: updated.frequency,
      categories: updated.categories,
      quietHoursStart: updated.quietHoursStart,
      quietHoursEnd: updated.quietHoursEnd,
    };
  }

  const [created] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      channels: input.channels,
      frequency: input.frequency,
      categories: input.categories,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
    })
    .returning();
  if (!created) throw AppError.internal("Failed to create preferences");

  return {
    channels: created.channels,
    frequency: created.frequency,
    categories: created.categories,
    quietHoursStart: created.quietHoursStart,
    quietHoursEnd: created.quietHoursEnd,
  };
}

/* ── Live SSE relay (in-memory pub/sub, Phase 15 will swap for Redis) ── */

export type LiveNotificationPayload = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
};

type LiveSubscriber = (n: LiveNotificationPayload) => void;
const liveSubscribers = new Map<string, Set<LiveSubscriber>>();

/** Subscribe to live notifications for a given user. Returns an unsubscribe fn. */
export function subscribeLive(userId: string, cb: LiveSubscriber): () => void {
  let set = liveSubscribers.get(userId);
  if (!set) {
    set = new Set();
    liveSubscribers.set(userId, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) liveSubscribers.delete(userId);
  };
}

/** Push a live notification to all subscribers for that user. */
async function notifyLive(
  userId: string,
  n: LiveNotificationPayload,
): Promise<void> {
  const set = liveSubscribers.get(userId);
  if (!set || set.size === 0) return;
  for (const cb of set) {
    try {
      cb(n);
    } catch {
      /* swallow */
    }
  }
}

/**
 * Publish a live notification to subscribers (used by other services — e.g.
 * messaging.ts when a new message is received).
 */
export async function publishLiveNotification(
  userId: string,
  n: LiveNotificationPayload,
): Promise<void> {
  await notifyLive(userId, n);
}
