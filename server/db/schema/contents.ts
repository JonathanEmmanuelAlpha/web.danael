/**
 * §10.3 — Educational content & files.
 *
 * - files (uploaded objects in R2/Uploadthing)
 * - contents (catalog of pedagogical resources)
 * - content_versions (history of file revisions)
 * - favorites (user bookmarks)
 * - content_notes (private user notes on a content)
 * - content_reports (moderation reports)
 */

import {
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  integer as pgInteger,
  numeric,
  index as pgIndex,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";

import { pgRef } from "./_env";
import { users } from "./users";
import { schools, classes, subjects, subjectSkills } from "./schools";
import {
  contentTypeEnum,
  contentVisibilityEnum,
  publicationStatusEnum,
  fileStatusEnum,
  reportStatusEnum,
  levelEnum,
  seriesEnum,
  difficultyEnum,
} from "./enums";

/* ─────────────────────────────────────────────────────────────
 * files — physical / presigned objects in storage
 * ──────────────────────────────────────────────────────────── */

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    /** Storage bucket / provider (r2 | uploadthing). */
    bucket: pgText("bucket").notNull(),
    /** Object key inside the bucket. */
    key: pgText("key").notNull(),
    originalName: pgText("original_name").notNull(),
    contentType: pgText("content_type").notNull(),
    /** Size in bytes. */
    size: pgInteger("size").notNull(),
    status: fileStatusEnum("status").notNull().default("pending"),
    fileUrl: pgText("file_url").notNull().default("R2_NOT_NEED_FILE_URL"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    ownerIdx: pgIndex("files_owner_id_idx").on(t.ownerId),
    keyIdx: pgIndex("files_key_idx").on(t.key),
    statusIdx: pgIndex("files_status_idx").on(t.status),
  }),
);

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * contents — main content catalog
 * ──────────────────────────────────────────────────────────── */

export const contents = pgTable(
  "contents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: contentTypeEnum("type").notNull(),
    title: pgText("title").notNull(),
    description: pgText("description"),
    subjectId: uuid("subject_id").references(() => pgRef(subjects.id), {
      onDelete: "set null",
    }),
    /** Skill the content targets (granular targeting — see subject_skills). */
    skillId: uuid("skill_id").references(() => pgRef(subjectSkills.id), {
      onDelete: "set null",
    }),
    level: levelEnum("level"),
    series: seriesEnum("series"),
    schoolId: uuid("school_id").references(() => pgRef(schools.id), {
      onDelete: "cascade",
    }),
    classId: uuid("class_id").references(() => pgRef(classes.id), {
      onDelete: "cascade",
    }),
    visibility: contentVisibilityEnum("visibility").notNull().default("public"),
    publicationStatus: publicationStatusEnum("publication_status")
      .notNull()
      .default("draft"),
    fileId: uuid("file_id").references(() => pgRef(files.id), {
      onDelete: "set null",
    }),
    thumbnailFileId: uuid("thumbnail_file_id").references(
      () => pgRef(files.id),
      {
        onDelete: "set null",
      },
    ),
    /** Academic year the resource targets (e.g. 2025). */
    year: pgInteger("year"),
    difficulty: difficultyEnum("difficulty"),
    /** Estimated reading/watch time in minutes. */
    durationMinutes: pgInteger("duration_minutes"),
    /** Free-form tags (e.g. "algebre", "geometrie"). */
    tags: pgText("tags").array().default([]).notNull(),
    /** Skill anchors (e.g. "Nombres complexes"). */
    skills: pgText("skills").array().default([]).notNull(),
    viewsCount: pgInteger("views_count").default(0).notNull(),
    downloadsCount: pgInteger("downloads_count").default(0).notNull(),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).default("0"),
    ratingCount: pgInteger("rating_count").default(0).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => pgRef(users.id), {
      onDelete: "set null",
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
    typeIdx: pgIndex("contents_type_idx").on(t.type),
    subjectIdx: pgIndex("contents_subject_id_idx").on(t.subjectId),
    skillIdx: pgIndex("contents_skill_id_idx").on(t.skillId),
    levelIdx: pgIndex("contents_level_idx").on(t.level),
    schoolIdx: pgIndex("contents_school_id_idx").on(t.schoolId),
    classIdx: pgIndex("contents_class_id_idx").on(t.classId),
    visibilityIdx: pgIndex("contents_visibility_idx").on(t.visibility),
    publicationIdx: pgIndex("contents_publication_status_idx").on(
      t.publicationStatus,
    ),
    uploadedByIdx: pgIndex("contents_uploaded_by_idx").on(t.uploadedBy),
  }),
);

export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * content_versions
 * ──────────────────────────────────────────────────────────── */

export const contentVersions = pgTable(
  "content_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => pgRef(contents.id), { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => pgRef(files.id), { onDelete: "cascade" }),
    version: pgInteger("version").notNull(),
    changeNote: pgText("change_note"),
    createdBy: uuid("created_by").references(() => pgRef(users.id), {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    contentIdx: pgIndex("content_versions_content_id_idx").on(t.contentId),
    fileIdx: pgIndex("content_versions_file_id_idx").on(t.fileId),
  }),
);

export type ContentVersion = typeof contentVersions.$inferSelect;
export type NewContentVersion = typeof contentVersions.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * favorites
 * ──────────────────────────────────────────────────────────── */

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => pgRef(contents.id), { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userContentIdx: pgUniqueIndex("favorites_user_content_uniq").on(
      t.userId,
      t.contentId,
    ),
    contentIdx: pgIndex("favorites_content_id_idx").on(t.contentId),
  }),
);

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * content_notes — private user notes
 * ──────────────────────────────────────────────────────────── */

export const contentNotes = pgTable(
  "content_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => pgRef(contents.id), { onDelete: "cascade" }),
    body: pgText("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    userContentIdx: pgIndex("content_notes_user_content_idx").on(
      t.userId,
      t.contentId,
    ),
  }),
);

export type ContentNote = typeof contentNotes.$inferSelect;
export type NewContentNote = typeof contentNotes.$inferInsert;

/* ─────────────────────────────────────────────────────────────
 * content_reports — moderation
 * ──────────────────────────────────────────────────────────── */

export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => pgRef(contents.id), { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => pgRef(users.id), { onDelete: "cascade" }),
    reason: pgText("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    contentIdx: pgIndex("content_reports_content_id_idx").on(t.contentId),
    statusIdx: pgIndex("content_reports_status_idx").on(t.status),
  }),
);
export type ContentReport = typeof contentReports.$inferSelect;
export type NewContentReport = typeof contentReports.$inferInsert;
