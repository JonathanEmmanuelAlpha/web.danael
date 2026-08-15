/**
 * §10.3 — Notifications & messaging.
 *
 * - notifications (per-user inbox)
 * - conversation_threads (direct / group / class / school)
 * - conversation_participants (membership + read cursors)
 * - messages (thread messages with optional attachment)
 * - announcements (broadcast from school admins / teachers)
 */
import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  jsonb,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { type JsonRecord, pgRef } from "./_env";
import { users } from "./users";
import { schools, classes } from "./schools";
import { files } from "./contents";
import {
  notificationTypeEnum,
  threadTypeEnum,
  messageStatusEnum,
  audienceEnum,
} from "./enums";

/* -------------------------------------------------------------
 * notifications — user inbox
 * ------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull().default("info"),
    title: pgText("title").notNull(),
    body: pgText("body"),
    /** Deep link rendered in the UI. */
    link: pgText("link"),
    metadata: jsonb("metadata").$type<JsonRecord>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: pgIndex("notifications_user_id_idx").on(t.userId),
    typeIdx: pgIndex("notifications_type_idx").on(t.type),
    readIdx: pgIndex("notifications_read_at_idx").on(t.readAt),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

/* -------------------------------------------------------------
 * conversation_threads
 * ------------------------------------------------------------ */

export const conversationThreads = pgTable(
  "conversation_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: threadTypeEnum("type").notNull().default("direct"),
    schoolId: uuid("school_id").references(() => pgRef(schools.id), {
      onDelete: "cascade",
    }),
    classId: uuid("class_id").references(() => pgRef(classes.id), {
      onDelete: "cascade",
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
    typeIdx: pgIndex("conversation_threads_type_idx").on(t.type),
    schoolIdx: pgIndex("conversation_threads_school_id_idx").on(t.schoolId),
    classIdx: pgIndex("conversation_threads_class_id_idx").on(t.classId),
  }),
);

export type ConversationThread = typeof conversationThreads.$inferSelect;
export type NewConversationThread = typeof conversationThreads.$inferInsert;

/* -------------------------------------------------------------
 * conversation_participants
 * ------------------------------------------------------------ */

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => pgRef(conversationThreads.id), { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (t) => ({
    threadUserIdx: pgUniqueIndex("conversation_participants_uniq").on(
      t.threadId,
      t.userId,
    ),
    userIdx: pgIndex("conversation_participants_user_id_idx").on(t.userId),
  }),
);

export type ConversationParticipant =
  typeof conversationParticipants.$inferSelect;
export type NewConversationParticipant =
  typeof conversationParticipants.$inferInsert;

/* -------------------------------------------------------------
 * messages
 * ------------------------------------------------------------ */

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => pgRef(conversationThreads.id), { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    body: pgText("body").notNull(),
    attachmentFileId: uuid("attachment_file_id").references(
      () => pgRef(files.id),
      {
        onDelete: "set null",
      },
    ),
    status: messageStatusEnum("status").notNull().default("sent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    threadIdx: pgIndex("messages_thread_id_idx").on(t.threadId),
    senderIdx: pgIndex("messages_sender_id_idx").on(t.senderId),
    createdIdx: pgIndex("messages_created_at_idx").on(t.createdAt),
  }),
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

/* -------------------------------------------------------------
 * announcements — broadcast messages
 * ------------------------------------------------------------ */

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").references(() => pgRef(schools.id), {
      onDelete: "cascade",
    }),
    classId: uuid("class_id").references(() => pgRef(classes.id), {
      onDelete: "cascade",
    }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    title: pgText("title").notNull(),
    body: pgText("body").notNull(),
    audience: audienceEnum("audience").notNull().default("school"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    schoolIdx: pgIndex("announcements_school_id_idx").on(t.schoolId),
    classIdx: pgIndex("announcements_class_id_idx").on(t.classId),
    authorIdx: pgIndex("announcements_author_id_idx").on(t.authorId),
    audienceIdx: pgIndex("announcements_audience_idx").on(t.audience),
    publishedIdx: pgIndex("announcements_published_at_idx").on(t.publishedAt),
  }),
);

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;

/* ------------------------------------------------------───────
 * notification_preferences — per-user channel / category prefs
 * ──────────────────────────────────────────────────────────── */

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Channels enabled (jsonb array of "email" | "sms" | "push" | "in_app"). */
    channels: jsonb("channels")
      .$type<string[]>()
      .notNull()
      .default(["in_app", "email"]),
    /** Digest frequency. */
    frequency: pgText("frequency").notNull().default("immediate"),
    /** Categories the user wants to receive (jsonb array). */
    categories: jsonb("categories")
      .$type<string[]>()
      .notNull()
      .default([
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
    quietHoursStart: pgText("quiet_hours_start"),
    quietHoursEnd: pgText("quiet_hours_end"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    userIdx: pgUniqueIndex("notification_preferences_user_uniq").on(t.userId),
  }),
);

export type NotificationPreferences =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences =
  typeof notificationPreferences.$inferInsert;
