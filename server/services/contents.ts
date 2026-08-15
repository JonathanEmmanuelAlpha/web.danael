/**
 * §5.4 — Content library service (business logic).
 *
 * Pure data-access layer used by server actions. Auth / RBAC is enforced by
 * the server actions wrapping these functions, not here.
 */

import { and, count, desc, eq, ilike, or, sql, asc, SQL } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  contents,
  contentNotes,
  contentReports,
  contentVersions,
  favorites,
  files,
  subjects,
  users,
  schools,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";
import type {
  CreateContentInput,
  UpdateContentInput,
  ListContentsQuery,
  SearchContentsQuery,
} from "@/server/validators/contents";
import type {
  Content,
  ContentNote,
  ContentReport,
  ContentVersion,
  File as ContentFileRow,
} from "@/server/db/schema/contents";
import type { Subject } from "@/server/db/schema/schools";
import type { User } from "@/server/db/schema/users";

/* -- Types --------------------------------------------------- */

export type { Content, ContentNote, ContentReport, ContentVersion };

export type Uploader = Pick<
  User,
  "id" | "email" | "firstName" | "lastName" | "avatarUrl"
>;

export type SubjectInfo = Pick<Subject, "id" | "name" | "code">;

export type ContentFile = Pick<
  ContentFileRow,
  "id" | "key" | "originalName" | "contentType" | "size" | "bucket" | "fileUrl"
>;

export type SchoolInfo = { id: string; name: string };

export type ContentWithRelations = Content & {
  subject: SubjectInfo | null;
  uploader: Uploader | null;
  file: ContentFile | null;
  thumbnail: ContentFile | null;
  school: SchoolInfo | null;
};

export type ContentListItem = Pick<
  Content,
  | "id"
  | "type"
  | "title"
  | "description"
  | "level"
  | "series"
  | "subjectId"
  | "visibility"
  | "publicationStatus"
  | "thumbnailFileId"
  | "fileId"
  | "year"
  | "difficulty"
  | "durationMinutes"
  | "viewsCount"
  | "downloadsCount"
  | "createdAt"
  | "updatedAt"
> & {
  subject: SubjectInfo | null;
  uploader: Pick<Uploader, "id" | "firstName" | "lastName"> | null;
};

export type ContentListResult = {
  items: ContentListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type FavoriteWithContent = {
  favoriteId: string;
  createdAt: Date;
  content: ContentListItem;
};

export type NoteWithAuthor = ContentNote & {
  author: Pick<User, "id" | "email" | "firstName" | "lastName" | "avatarUrl">;
};

/* -- Mutations ----------------------------------------------- */

/**
 * Create a content entry + link its file (if provided).
 */
export async function createContent(
  input: CreateContentInput,
  creatorUserId: string,
): Promise<Content> {
  const db = await getDb();

  const [created] = await db
    .insert(contents)
    .values({
      type: input.type,
      title: input.title,
      description: input.description,
      subjectId: input.subjectId,
      level: input.level,
      series: input.series,
      schoolId: input.schoolId,
      classId: input.classId,
      visibility: input.visibility,
      publicationStatus: input.publicationStatus,
      fileId: input.fileId,
      thumbnailFileId: input.thumbnailFileId,
      year: input.year,
      difficulty: input.difficulty,
      durationMinutes: input.durationMinutes,
      tags: input.tags,
      skills: input.skills,
      uploadedBy: creatorUserId,
    })
    .returning();

  if (!created) throw AppError.internal("Failed to create content");

  // If a file was linked, register a v1 version entry for history.
  if (input.fileId) {
    try {
      await db.insert(contentVersions).values({
        contentId: created.id,
        fileId: input.fileId,
        version: 1,
        changeNote: "Initial upload",
        createdBy: creatorUserId,
      });
    } catch {
      // Best-effort — versioning must not block content creation.
    }
  }

  return created;
}

/**
 * Update editable content fields.
 */
export async function updateContent(
  id: string,
  input: UpdateContentInput,
): Promise<Content> {
  const db = await getDb();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.type !== undefined) updates.type = input.type;
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.subjectId !== undefined) updates.subjectId = input.subjectId;
  if (input.level !== undefined) updates.level = input.level;
  if (input.series !== undefined) updates.series = input.series;
  if (input.schoolId !== undefined) updates.schoolId = input.schoolId;
  if (input.classId !== undefined) updates.classId = input.classId;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.publicationStatus !== undefined)
    updates.publicationStatus = input.publicationStatus;
  if (input.fileId !== undefined) {
    updates.fileId = input.fileId;
    // If a new file is provided, create a new version row.
    if (input.fileId) {
      try {
        const versions = await db
          .select({ v: contentVersions.version })
          .from(contentVersions)
          .where(eq(contentVersions.contentId, id))
          .orderBy(desc(contentVersions.version))
          .limit(1);
        const nextVersion = (versions.at(0)?.v ?? 0) + 1;
        await db.insert(contentVersions).values({
          contentId: id,
          fileId: input.fileId,
          version: nextVersion,
          changeNote: "Updated file",
        });
      } catch {
        // Best-effort.
      }
    }
  }
  if (input.thumbnailFileId !== undefined)
    updates.thumbnailFileId = input.thumbnailFileId;
  if (input.year !== undefined) updates.year = input.year;
  if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
  if (input.durationMinutes !== undefined)
    updates.durationMinutes = input.durationMinutes;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.skills !== undefined) updates.skills = input.skills;

  const [updated] = await db
    .update(contents)
    .set(updates)
    .where(eq(contents.id, id))
    .returning();

  if (!updated) throw AppError.notFound("Content not found");
  return updated;
}

/**
 * Soft-delete a content (archive). The row is kept for audit / restore.
 */
export async function deleteContent(id: string): Promise<Content> {
  const db = await getDb();
  const [updated] = await db
    .update(contents)
    .set({
      visibility: "archived",
      publicationStatus: "archived",
      updatedAt: new Date(),
    })
    .where(eq(contents.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Content not found");
  return updated;
}

/**
 * Publish a content (set publication_status = published, visibility = public if it was draft).
 */
export async function publishContent(id: string): Promise<Content> {
  const db = await getDb();
  const current = await getContentById(id);
  const nextVisibility =
    current.visibility === "draft" ? "public" : current.visibility;

  const [updated] = await db
    .update(contents)
    .set({
      publicationStatus: "published",
      visibility: nextVisibility,
      updatedAt: new Date(),
    })
    .where(eq(contents.id, id))
    .returning();
  if (!updated) throw AppError.notFound("Content not found");
  return updated;
}

/**
 * Increment the views counter (idempotent — safe to call on every page view).
 */
export async function incrementViews(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(contents)
    .set({ viewsCount: sql`${contents.viewsCount} + 1` })
    .where(eq(contents.id, id));
}

/**
 * Increment the downloads counter.
 */
export async function incrementDownloads(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(contents)
    .set({ downloadsCount: sql`${contents.downloadsCount} + 1` })
    .where(eq(contents.id, id));
}

/* -- Queries ------------------------------------------------- */

/**
 * Get a content by id with its subject, uploader, file info, thumbnail.
 *
 * We do two separate fetches for `file` and `thumbnail` to keep the query
 * shape simple (avoiding a self-join on `files`).
 */
export async function getContentById(
  id: string,
): Promise<ContentWithRelations> {
  const db = await getDb();

  const rows = await db
    .select({
      content: contents,
      subject: subjects,
      uploader: users,
      school: schools,
    })
    .from(contents)
    .leftJoin(subjects, eq(subjects.id, contents.subjectId))
    .leftJoin(users, eq(users.id, contents.uploadedBy))
    .leftJoin(schools, eq(schools.id, contents.schoolId))
    .where(eq(contents.id, id))
    .limit(1);

  const row = rows.at(0);
  if (!row) throw AppError.notFound("Content not found");

  const content = row.content;

  // Fetch primary file.
  let file: ContentFile | null = null;
  if (content.fileId) {
    const fileRows = await db
      .select({
        id: files.id,
        key: files.key,
        originalName: files.originalName,
        contentType: files.contentType,
        size: files.size,
        bucket: files.bucket,
        fileUrl: files.fileUrl,
      })
      .from(files)
      .where(eq(files.id, content.fileId))
      .limit(1);
    file = (fileRows.at(0) as ContentFile) ?? null;
  }

  // Fetch thumbnail file.
  let thumbnail: ContentFile | null = null;
  if (content.thumbnailFileId) {
    const thumbRows = await db
      .select({
        id: files.id,
        key: files.key,
        originalName: files.originalName,
        contentType: files.contentType,
        size: files.size,
        bucket: files.bucket,
        fileUrl: files.fileUrl,
      })
      .from(files)
      .where(eq(files.id, content.thumbnailFileId))
      .limit(1);
    thumbnail = (thumbRows.at(0) as ContentFile) ?? null;
  }

  return {
    ...content,
    subject: row.subject?.id ? (row.subject as SubjectInfo) : null,
    uploader: row.uploader?.id ? (row.uploader as Uploader) : null,
    file,
    thumbnail,
    school: row.school?.id
      ? { id: row.school.id, name: row.school.name }
      : null,
  };
}

/**
 * List contents with filters + pagination.
 *
 * By default only `published` + non-archived contents are returned. Pass
 * `publicationStatus` / `visibility` to override.
 */
export async function listContents(
  filters: ListContentsQuery,
): Promise<ContentListResult> {
  const db = await getDb();

  const conditions: SQL<unknown>[] = [];

  if (filters.search) {
    const needle = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(contents.title, needle),
        ilike(contents.description, needle),
      ) as never,
    );
  }
  if (filters.type) conditions.push(eq(contents.type, filters.type) as never);
  if (filters.level)
    conditions.push(eq(contents.level, filters.level) as never);
  if (filters.series)
    conditions.push(eq(contents.series, filters.series) as never);
  if (filters.subjectId)
    conditions.push(eq(contents.subjectId, filters.subjectId) as never);
  if (filters.schoolId)
    conditions.push(eq(contents.schoolId, filters.schoolId) as never);
  if (filters.classId)
    conditions.push(eq(contents.classId, filters.classId) as never);
  if (filters.visibility)
    conditions.push(eq(contents.visibility, filters.visibility) as never);
  if (filters.publicationStatus)
    conditions.push(
      eq(contents.publicationStatus, filters.publicationStatus) as never,
    );
  if (filters.difficulty)
    conditions.push(eq(contents.difficulty, filters.difficulty) as never);
  if (filters.uploadedBy)
    conditions.push(eq(contents.uploadedBy, filters.uploadedBy) as never);

  // Default visibility filter: exclude archived unless explicitly requested.
  if (!filters.visibility) {
    conditions.push(sql`${contents.visibility} != 'archived'` as never);
  }
  if (!filters.publicationStatus) {
    conditions.push(
      or(
        eq(contents.publicationStatus, "published"),
        eq(contents.publicationStatus, "in_review"),
      ) as never,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Sort.
  const orderBy =
    filters.sort === "popular"
      ? [desc(contents.viewsCount)]
      : filters.sort === "downloads"
        ? [desc(contents.downloadsCount)]
        : filters.sort === "title"
          ? [asc(contents.title)]
          : [desc(contents.createdAt)];

  const offset = (filters.page - 1) * filters.pageSize;

  const rows = await db
    .select({
      id: contents.id,
      type: contents.type,
      title: contents.title,
      description: contents.description,
      level: contents.level,
      series: contents.series,
      subjectId: contents.subjectId,
      visibility: contents.visibility,
      publicationStatus: contents.publicationStatus,
      thumbnailFileId: contents.thumbnailFileId,
      fileId: contents.fileId,
      year: contents.year,
      difficulty: contents.difficulty,
      durationMinutes: contents.durationMinutes,
      viewsCount: contents.viewsCount,
      downloadsCount: contents.downloadsCount,
      createdAt: contents.createdAt,
      updatedAt: contents.updatedAt,
      subject: subjects,
      uploader: users,
    })
    .from(contents)
    .leftJoin(subjects, eq(subjects.id, contents.subjectId))
    .leftJoin(users, eq(users.id, contents.uploadedBy))
    .where(where)
    .orderBy(...orderBy)
    .limit(filters.pageSize)
    .offset(offset);

  const totalRow = await db
    .select({ c: count() })
    .from(contents)
    .leftJoin(subjects, eq(subjects.id, contents.subjectId))
    .leftJoin(users, eq(users.id, contents.uploadedBy))
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  const items: ContentListItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    level: r.level,
    series: r.series,
    subjectId: r.subjectId,
    visibility: r.visibility,
    publicationStatus: r.publicationStatus,
    thumbnailFileId: r.thumbnailFileId,
    fileId: r.fileId,
    year: r.year,
    difficulty: r.difficulty,
    durationMinutes: r.durationMinutes,
    viewsCount: r.viewsCount,
    downloadsCount: r.downloadsCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    subject: r.subject?.id ? (r.subject as SubjectInfo) : null,
    uploader: r.uploader?.id
      ? (r.uploader as ContentListItem["uploader"])
      : null,
  }));

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

/**
 * Search contents by free-text query (ILIKE on title + description + tags).
 *
 * On SQLite, Drizzle compiles `ilike` to `LOWER(col) LIKE LOWER(pattern)`.
 */
export async function searchContents(
  input: SearchContentsQuery,
): Promise<ContentListResult> {
  const db = await getDb();

  const needle = `%${input.query}%`;
  const searchCondition = or(
    ilike(contents.title, needle),
    ilike(contents.description, needle),
    ilike(sql`CAST(${contents.tags} AS TEXT)`, needle),
  );

  const conditions = [
    searchCondition as never,
    sql`${contents.visibility} != 'archived'` as never,
    eq(contents.publicationStatus, "published") as never,
  ];
  if (input.type) conditions.push(eq(contents.type, input.type) as never);
  if (input.level) conditions.push(eq(contents.level, input.level) as never);
  if (input.series) conditions.push(eq(contents.series, input.series) as never);
  if (input.subjectId)
    conditions.push(eq(contents.subjectId, input.subjectId) as never);
  if (input.difficulty)
    conditions.push(eq(contents.difficulty, input.difficulty) as never);

  const where = and(...conditions);
  const offset = (input.page - 1) * input.pageSize;

  const rows = await db
    .select({
      id: contents.id,
      type: contents.type,
      title: contents.title,
      description: contents.description,
      level: contents.level,
      series: contents.series,
      subjectId: contents.subjectId,
      visibility: contents.visibility,
      publicationStatus: contents.publicationStatus,
      thumbnailFileId: contents.thumbnailFileId,
      fileId: contents.fileId,
      year: contents.year,
      difficulty: contents.difficulty,
      durationMinutes: contents.durationMinutes,
      viewsCount: contents.viewsCount,
      downloadsCount: contents.downloadsCount,
      createdAt: contents.createdAt,
      updatedAt: contents.updatedAt,
      subject: subjects,
      uploader: users,
    })
    .from(contents)
    .leftJoin(subjects, eq(subjects.id, contents.subjectId))
    .leftJoin(users, eq(users.id, contents.uploadedBy))
    .where(where)
    .orderBy(desc(contents.viewsCount), desc(contents.createdAt))
    .limit(input.pageSize)
    .offset(offset);

  const totalRow = await db
    .select({ c: count() })
    .from(contents)
    .leftJoin(subjects, eq(subjects.id, contents.subjectId))
    .leftJoin(users, eq(users.id, contents.uploadedBy))
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  const items: ContentListItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    level: r.level,
    series: r.series,
    subjectId: r.subjectId,
    visibility: r.visibility,
    publicationStatus: r.publicationStatus,
    thumbnailFileId: r.thumbnailFileId,
    fileId: r.fileId,
    year: r.year,
    difficulty: r.difficulty,
    durationMinutes: r.durationMinutes,
    viewsCount: r.viewsCount,
    downloadsCount: r.downloadsCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    subject: r.subject?.id ? (r.subject as SubjectInfo) : null,
    uploader: r.uploader?.id
      ? (r.uploader as ContentListItem["uploader"])
      : null,
  }));

  return { items, total, page: input.page, pageSize: input.pageSize };
}

/* -- Favorites ----------------------------------------------- */

/**
 * Toggle a favorite on/off. Returns `true` if now favorited, `false` otherwise.
 */
export async function toggleFavorite(
  userId: string,
  contentId: string,
): Promise<{ favorited: boolean }> {
  const db = await getDb();

  const existingRows = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.contentId, contentId)),
    )
    .limit(1);
  const existing = existingRows.at(0);

  if (existing) {
    await db.delete(favorites).where(eq(favorites.id, existing.id));
    return { favorited: false };
  }

  await db.insert(favorites).values({ userId, contentId });
  return { favorited: true };
}

/**
 * Returns true if the user has favorited the content.
 */
export async function isFavorited(
  userId: string,
  contentId: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.contentId, contentId)),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * List the user's favorite contents (paginated).
 */
export async function listFavorites(
  userId: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<{
  items: FavoriteWithContent[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const where = and(
    eq(favorites.userId, userId),
    sql`${contents.visibility} != 'archived'` as never,
  );

  const rows = await db
    .select({
      favoriteId: favorites.id,
      favoriteCreatedAt: favorites.createdAt,
      id: contents.id,
      type: contents.type,
      title: contents.title,
      description: contents.description,
      level: contents.level,
      series: contents.series,
      subjectId: contents.subjectId,
      visibility: contents.visibility,
      publicationStatus: contents.publicationStatus,
      thumbnailFileId: contents.thumbnailFileId,
      fileId: contents.fileId,
      year: contents.year,
      difficulty: contents.difficulty,
      durationMinutes: contents.durationMinutes,
      viewsCount: contents.viewsCount,
      downloadsCount: contents.downloadsCount,
      createdAt: contents.createdAt,
      updatedAt: contents.updatedAt,
      subject: subjects,
      uploader: users,
    })
    .from(favorites)
    .innerJoin(contents, eq(contents.id, favorites.contentId))
    .leftJoin(subjects, eq(subjects.id, contents.subjectId))
    .leftJoin(users, eq(users.id, contents.uploadedBy))
    .where(where)
    .orderBy(desc(favorites.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalRow = await db
    .select({ c: count() })
    .from(favorites)
    .innerJoin(contents, eq(contents.id, favorites.contentId))
    .where(where);
  const total = Number(totalRow.at(0)?.c ?? 0);

  const items: FavoriteWithContent[] = rows.map((r) => ({
    favoriteId: r.favoriteId,
    createdAt: r.favoriteCreatedAt,
    content: {
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      level: r.level,
      series: r.series,
      subjectId: r.subjectId,
      visibility: r.visibility,
      publicationStatus: r.publicationStatus,
      thumbnailFileId: r.thumbnailFileId,
      fileId: r.fileId,
      year: r.year,
      difficulty: r.difficulty,
      durationMinutes: r.durationMinutes,
      viewsCount: r.viewsCount,
      downloadsCount: r.downloadsCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      subject: r.subject?.id ? (r.subject as SubjectInfo) : null,
      uploader: r.uploader?.id
        ? (r.uploader as ContentListItem["uploader"])
        : null,
    },
  }));

  return { items, total, page, pageSize };
}

/* -- Notes ---------------------------------------------------- */

/**
 * Add a private note on a content.
 */
export async function addNote(
  userId: string,
  contentId: string,
  body: string,
): Promise<ContentNote> {
  const db = await getDb();
  const [created] = await db
    .insert(contentNotes)
    .values({ userId, contentId, body })
    .returning();
  if (!created) throw AppError.internal("Failed to add note");
  return created;
}

/**
 * List the user's notes on a content.
 */
export async function listNotes(
  userId: string,
  contentId: string,
): Promise<NoteWithAuthor[]> {
  const db = await getDb();
  const rows = await db
    .select({
      note: contentNotes,
      author: users,
    })
    .from(contentNotes)
    .innerJoin(users, eq(users.id, contentNotes.userId))
    .where(
      and(
        eq(contentNotes.contentId, contentId),
        eq(contentNotes.userId, userId),
      ),
    )
    .orderBy(desc(contentNotes.createdAt));

  return rows.map((r) => ({ ...r.note, author: r.author }));
}

/* -- Reports ------------------------------------------------- */

/**
 * Report a content for moderation.
 */
export async function reportContent(
  contentId: string,
  reporterId: string,
  reason: string,
): Promise<ContentReport> {
  const db = await getDb();
  const [created] = await db
    .insert(contentReports)
    .values({ contentId, reporterId, reason })
    .returning();
  if (!created) throw AppError.internal("Failed to submit report");
  return created;
}

/* -- Versions ------------------------------------------------ */

/**
 * List the version history of a content.
 */
export async function listContentVersions(
  contentId: string,
): Promise<
  Array<ContentVersion & { fileName: string | null; fileSize: number | null }>
> {
  const db = await getDb();
  const rows = await db
    .select({
      version: contentVersions,
      fileName: files.originalName,
      fileSize: files.size,
    })
    .from(contentVersions)
    .leftJoin(files, eq(files.id, contentVersions.fileId))
    .where(eq(contentVersions.contentId, contentId))
    .orderBy(desc(contentVersions.version));

  return rows.map((r) => ({
    ...r.version,
    fileName: r.fileName ?? null,
    fileSize: r.fileSize ?? null,
  }));
}

/* -- Helpers ------------------------------------------------- */

/**
 * Resolve the storage key for a content's primary file.
 */
export async function getContentFileKey(
  contentId: string,
): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ key: files.key })
    .from(contents)
    .leftJoin(files, eq(files.id, contents.fileId))
    .where(eq(contents.id, contentId))
    .limit(1);
  return rows.at(0)?.key ?? null;
}
