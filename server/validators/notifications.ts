/**
 * §5.12 — Notifications validators (Zod v4).
 */

import { z } from "zod";

import { NOTIFICATION_TYPE_VALUES } from "@/server/db/schema/enums";

/* ── Notifications ────────────────────────────────────────── */

export const createNotificationSchema = z.object({
  userId: z.uuid(),
  type: z.enum(NOTIFICATION_TYPE_VALUES).default("info"),
  title: z.string().min(1).max(300),
  body: z.string().max(2000).optional(),
  link: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const listNotificationsQuerySchema = z.object({
  type: z.enum(NOTIFICATION_TYPE_VALUES).optional(),
  /** "unread" | "read" | undefined (all) */
  read: z.enum(["unread", "read"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/* ── Preferences ─────────────────────────────────────────── */

export const channelEnum = z.enum(["email", "sms", "push", "in_app"]);
export type ChannelValue = z.infer<typeof channelEnum>;

export const frequencyEnum = z.enum(["immediate", "daily", "weekly"]);
export type FrequencyValue = z.infer<typeof frequencyEnum>;

export const categoryEnum = z.enum([
  "assignments",
  "grades",
  "announcements",
  "messages",
  "reminders",
  "social",
  "system",
  "billing",
]);
export type CategoryValue = z.infer<typeof categoryEnum>;

export const updateNotificationPreferencesSchema = z.object({
  /** Channels enabled by the user. */
  channels: z.array(channelEnum).default(["in_app", "email"]),
  /** Digest frequency. */
  frequency: frequencyEnum.default("immediate"),
  /** Categories the user wants to receive. */
  categories: z.array(categoryEnum).default([
    "assignments",
    "grades",
    "announcements",
    "messages",
    "reminders",
    "social",
    "system",
    "billing",
  ]),
  /** Quiet hours window (24h "HH:mm"). null disables quiet hours. */
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Expected HH:mm format")
    .nullable()
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Expected HH:mm format")
    .nullable()
    .optional(),
});
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

export const notificationTypeValues = NOTIFICATION_TYPE_VALUES;
