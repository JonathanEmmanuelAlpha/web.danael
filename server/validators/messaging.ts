/**
 * §5.11 — Messaging & announcements validators (Zod v4).
 *
 * Schemas are used by server actions and (Standard Schema) by client forms.
 */

import { z } from "zod";

import {
  THREAD_TYPE_VALUES,
  MESSAGE_STATUS_VALUES,
  AUDIENCE_VALUES,
} from "@/server/db/schema/enums";

/* ── Threads ───────────────────────────────────────────────── */

export const createThreadSchema = z.object({
  type: z.enum(THREAD_TYPE_VALUES).default("direct"),
  schoolId: z.uuid().optional(),
  classId: z.uuid().optional(),
  /** Initial participant user ids (excluding the creator — the server action adds them). */
  participantIds: z.array(z.uuid()).min(1, "At least one participant is required").max(50),
});
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

export const addParticipantSchema = z.object({
  threadId: z.uuid(),
  userId: z.uuid(),
});
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

export const removeParticipantSchema = z.object({
  threadId: z.uuid(),
  userId: z.uuid(),
});
export type RemoveParticipantInput = z.infer<typeof removeParticipantSchema>;

/* ── Messages ─────────────────────────────────────────────── */

export const sendMessageSchema = z.object({
  threadId: z.uuid(),
  body: z.string().min(1, "Message body cannot be empty").max(5000),
  attachmentFileId: z.uuid().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const listMessagesQuerySchema = z.object({
  threadId: z.uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime().optional(),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const listThreadsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListThreadsQuery = z.infer<typeof listThreadsQuerySchema>;

/* ── Announcements ────────────────────────────────────────── */

export const createAnnouncementSchema = z
  .object({
    title: z.string().min(2, "Title too short").max(200),
    body: z.string().min(1, "Body is required").max(5000),
    audience: z.enum(AUDIENCE_VALUES).default("school"),
    schoolId: z.uuid().optional(),
    classId: z.uuid().optional(),
    /** When true, the announcement is published immediately (publishedAt set). */
    publish: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // class announcements require classId, school announcements require schoolId.
      if (data.audience === "class") return Boolean(data.classId);
      if (data.audience === "school") return Boolean(data.schoolId);
      return true;
    },
    {
      message: "class audience requires classId, school audience requires schoolId",
      path: ["audience"],
    },
  );
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const listAnnouncementsQuerySchema = z.object({
  schoolId: z.uuid().optional(),
  classId: z.uuid().optional(),
  audience: z.enum(AUDIENCE_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAnnouncementsQuery = z.infer<typeof listAnnouncementsQuerySchema>;

export const messageStatusValues = MESSAGE_STATUS_VALUES;
