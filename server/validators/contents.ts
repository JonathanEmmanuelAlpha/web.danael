/**
 * §10.3 — Content validators (Zod v4).
 */

import { z } from "zod";

import {
  CONTENT_TYPE_VALUES,
  CONTENT_VISIBILITY_VALUES,
  PUBLICATION_STATUS_VALUES,
  LEVEL_VALUES,
  SERIES_VALUES,
  DIFFICULTY_VALUES,
} from "@/server/db/schema/enums";

/**
 * Create a content entry (file is uploaded separately via presigned URL).
 */
export const createContentSchema = z.object({
  type: z.enum(CONTENT_TYPE_VALUES),
  title: z.string().min(2, "Title too short").max(200),
  description: z.string().max(2000).optional(),
  subjectId: z.uuid().optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  schoolId: z.uuid().optional(),
  classId: z.uuid().optional(),
  visibility: z.enum(CONTENT_VISIBILITY_VALUES).default("public"),
  publicationStatus: z.enum(PUBLICATION_STATUS_VALUES).default("draft"),
  fileId: z.uuid().optional(),
  thumbnailFileId: z.uuid().optional(),
  year: z.number().int().min(1990).max(2100).optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).optional(),
  durationMinutes: z.number().int().min(0).max(60 * 24).optional(),
  tags: z.array(z.string().min(1).max(60)).max(20).default([]),
  skills: z.array(z.string().min(1).max(120)).max(20).default([]),
});

/**
 * Update a content — all fields optional except id.
 */
export const updateContentSchema = z.object({
  id: z.uuid(),
  type: z.enum(CONTENT_TYPE_VALUES).optional(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  subjectId: z.uuid().nullable().optional(),
  level: z.enum(LEVEL_VALUES).nullable().optional(),
  series: z.enum(SERIES_VALUES).nullable().optional(),
  schoolId: z.uuid().nullable().optional(),
  classId: z.uuid().nullable().optional(),
  visibility: z.enum(CONTENT_VISIBILITY_VALUES).optional(),
  publicationStatus: z.enum(PUBLICATION_STATUS_VALUES).optional(),
  fileId: z.uuid().nullable().optional(),
  thumbnailFileId: z.uuid().nullable().optional(),
  year: z.number().int().min(1990).max(2100).optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).nullable().optional(),
  durationMinutes: z.number().int().min(0).max(60 * 24).optional(),
  tags: z.array(z.string().min(1).max(60)).max(20).optional(),
  skills: z.array(z.string().min(1).max(120)).max(20).optional(),
});

/**
 * Schema for filter queries (listing page).
 */
export const listContentsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  type: z.enum(CONTENT_TYPE_VALUES).optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  subjectId: z.uuid().optional(),
  schoolId: z.uuid().optional(),
  classId: z.uuid().optional(),
  visibility: z.enum(CONTENT_VISIBILITY_VALUES).optional(),
  publicationStatus: z.enum(PUBLICATION_STATUS_VALUES).optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).optional(),
  uploadedBy: z.uuid().optional(),
  /** Sort: relevance | recent | popular | downloads */
  sort: z.enum(["recent", "popular", "downloads", "title"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Schema for free-text search queries.
 */
export const searchContentsQuerySchema = z.object({
  query: z.string().min(1).max(200),
  type: z.enum(CONTENT_TYPE_VALUES).optional(),
  level: z.enum(LEVEL_VALUES).optional(),
  series: z.enum(SERIES_VALUES).optional(),
  subjectId: z.uuid().optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Add a private note on a content.
 */
export const addContentNoteSchema = z.object({
  contentId: z.uuid(),
  body: z.string().min(1, "Note body cannot be empty").max(5000),
});

/**
 * Report a content for moderation.
 */
export const reportContentSchema = z.object({
  contentId: z.uuid(),
  reason: z.string().min(5, "Please describe the issue").max(2000),
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type ListContentsQuery = z.infer<typeof listContentsQuerySchema>;
export type SearchContentsQuery = z.infer<typeof searchContentsQuerySchema>;
export type AddContentNoteInput = z.infer<typeof addContentNoteSchema>;
export type ReportContentInput = z.infer<typeof reportContentSchema>;
