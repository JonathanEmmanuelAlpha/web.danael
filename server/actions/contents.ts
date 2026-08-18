"use server";

/**
 * §5.4 — Content library server actions.
 *
 * Wraps the contents service with auth + RBAC + Zod validation. Each action
 * returns a typed ApiResponse<T>.
 */

import { revalidatePath } from "next/cache";

import { getCurrentDbUser, requireSession } from "@/lib/clerk";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/server/permissions";
import {
  createContentSchema,
  updateContentSchema,
  listContentsQuerySchema,
  searchContentsQuerySchema,
  addContentNoteSchema,
  reportContentSchema,
  type CreateContentInput,
  type UpdateContentInput,
  type ListContentsQuery,
  type SearchContentsQuery,
  type AddContentNoteInput,
  type ReportContentInput,
} from "@/server/validators/contents";
import * as contentsService from "@/server/services/contents";
import type {
  Content,
  ContentWithRelations,
  ContentListResult,
  FavoriteWithContent,
  NoteWithAuthor,
  ContentReport,
  ContentVersion,
  ViewerScope,
} from "@/server/services/contents";

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Returns true if the current user can edit/delete the given content.
 * - The uploader
 * - A platform_admin / content_moderator
 */
async function canModifyContent(
  content: Pick<Content, "uploadedBy">,
  userId: string,
  role: string,
): Promise<boolean> {
  if (content.uploadedBy === userId) return true;
  if (role === "platform_admin" || role === "content_moderator") return true;
  return false;
}

/* ── Mutations ─────────────────────────────────────────────── */

export async function createContentAction(
  input: CreateContentInput,
): Promise<ApiResponse<Content>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Permission: teachers / school_admins / platform_admins can create.
    if (
      !hasPermission(dbUser.role, "content:create")
    ) {
      throw AppError.unauthorized(
        "Your role cannot upload contents. Ask a teacher or school admin.",
      );
    }

    const parsed = createContentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const created = await contentsService.createContent(parsed.data, dbUser.id);
    logger.info("Content created", {
      contentId: created.id,
      title: created.title,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/library");
    revalidatePath("/contents");
    return { success: true, data: created };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("createContentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not create content" },
    };
  }
}

export async function updateContentAction(
  input: UpdateContentInput,
): Promise<ApiResponse<Content>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = updateContentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    // Fetch existing content to check ownership.
    const existing = await contentsService.getContentById(parsed.data.id);
    const canModify = await canModifyContent(existing, dbUser.id, dbUser.role);
    if (!canModify) {
      throw AppError.forbidden("You can only edit your own contents");
    }

    const updated = await contentsService.updateContent(parsed.data.id, parsed.data);
    logger.info("Content updated", {
      contentId: updated.id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/library");
    revalidatePath(`/contents/${updated.id}`);
    revalidatePath("/contents");
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("updateContentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not update content" },
    };
  }
}

export async function deleteContentAction(
  id: string,
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const existing = await contentsService.getContentById(id);
    const canModify = await canModifyContent(existing, dbUser.id, dbUser.role);
    if (!canModify) {
      throw AppError.forbidden("You can only delete your own contents");
    }

    await contentsService.deleteContent(id);
    logger.info("Content archived", {
      contentId: id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/library");
    revalidatePath("/contents");
    return { success: true, data: { deleted: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("deleteContentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not delete content" },
    };
  }
}

export async function publishContentAction(
  id: string,
): Promise<ApiResponse<Content>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    // Only platform_admin / content_moderator can publish content.
    // Teachers and school_admins create drafts; an admin reviews and publishes.
    if (!hasPermission(dbUser.role, "content:publish")) {
      throw AppError.unauthorized(
        "Only platform administrators can publish content. " +
          "Teachers and school admins can submit drafts for review.",
      );
    }

    const existing = await contentsService.getContentById(id);
    if (!existing) throw AppError.notFound("Content not found");

    const published = await contentsService.publishContent(id);
    logger.info("Content published", {
      contentId: id,
      byUserId: dbUser.id,
      clerkId: session.clerkId,
    });
    revalidatePath("/library");
    revalidatePath(`/contents/${id}`);
    revalidatePath("/contents");
    revalidatePath("/admin/contents");
    return { success: true, data: published };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("publishContentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not publish content" },
    };
  }
}

export async function incrementViewsAction(
  id: string,
): Promise<ApiResponse<{ viewed: boolean }>> {
  try {
    await requireSession();
    await contentsService.incrementViews(id);
    return { success: true, data: { viewed: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("incrementViewsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not increment views" },
    };
  }
}

export async function incrementDownloadsAction(
  id: string,
): Promise<ApiResponse<{ downloaded: boolean }>> {
  try {
    await requireSession();
    await contentsService.incrementDownloads(id);
    return { success: true, data: { downloaded: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("incrementDownloadsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not increment downloads" },
    };
  }
}

/* ── Favorites ─────────────────────────────────────────────── */

export async function toggleFavoriteAction(
  contentId: string,
): Promise<ApiResponse<{ favorited: boolean }>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const result = await contentsService.toggleFavorite(dbUser.id, contentId);
    logger.info("Favorite toggled", {
      contentId,
      userId: dbUser.id,
      favorited: result.favorited,
      clerkId: session.clerkId,
    });
    revalidatePath(`/contents/${contentId}`);
    revalidatePath("/favorites");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("toggleFavoriteAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not toggle favorite" },
    };
  }
}

export async function listFavoritesAction(
  opts: { page?: number; pageSize?: number } = {},
): Promise<ApiResponse<{ items: FavoriteWithContent[]; total: number; page: number; pageSize: number }>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");
    const result = await contentsService.listFavorites(dbUser.id, opts);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listFavoritesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load favorites" },
    };
  }
}

export async function isFavoritedAction(
  contentId: string,
): Promise<ApiResponse<{ favorited: boolean }>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) {
      return { success: true, data: { favorited: false } };
    }
    const favorited = await contentsService.isFavorited(dbUser.id, contentId);
    return { success: true, data: { favorited } };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("isFavoritedAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not check favorite" },
    };
  }
}

/* ── Notes ─────────────────────────────────────────────────── */

export async function addNoteAction(
  input: AddContentNoteInput,
): Promise<ApiResponse<NoteWithAuthor>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = addContentNoteSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const note = await contentsService.addNote(
      dbUser.id,
      parsed.data.contentId,
      parsed.data.body,
    );
    logger.info("Note added", {
      noteId: note.id,
      contentId: parsed.data.contentId,
      userId: dbUser.id,
      clerkId: session.clerkId,
    });

    // Re-fetch the list with author info.
    const notes = await contentsService.listNotes(
      dbUser.id,
      parsed.data.contentId,
    );
    const enriched = notes.find((n) => n.id === note.id);
    if (!enriched) throw AppError.internal("Note added but could not be reloaded");
    return { success: true, data: enriched };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("addNoteAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not add note" },
    };
  }
}

export async function listNotesAction(
  contentId: string,
): Promise<ApiResponse<NoteWithAuthor[]>> {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser) {
      return { success: true, data: [] };
    }
    const notes = await contentsService.listNotes(dbUser.id, contentId);
    return { success: true, data: notes };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listNotesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load notes" },
    };
  }
}

/* ── Reports ───────────────────────────────────────────────── */

export async function reportContentAction(
  input: ReportContentInput,
): Promise<ApiResponse<ContentReport>> {
  try {
    const session = await requireSession();
    const dbUser = await getCurrentDbUser();
    if (!dbUser) throw AppError.notFound("User profile not found");

    const parsed = reportContentSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input", parsed.error.flatten());
    }

    const report = await contentsService.reportContent(
      parsed.data.contentId,
      dbUser.id,
      parsed.data.reason,
    );
    logger.info("Content reported", {
      reportId: report.id,
      contentId: parsed.data.contentId,
      reporterId: dbUser.id,
      clerkId: session.clerkId,
    });
    return { success: true, data: report };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("reportContentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not submit report" },
    };
  }
}

/* ── Queries ───────────────────────────────────────────────── */

export async function getContentAction(
  id: string,
): Promise<ApiResponse<ContentWithRelations>> {
  try {
    await requireSession();
    const content = await contentsService.getContentById(id);
    // Optional: fire-and-forget view increment.
    void contentsService.incrementViews(id).catch(() => {
      // Non-blocking.
    });
    return { success: true, data: content };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("getContentAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load content" },
    };
  }
}

export async function listContentsAction(
  filters: ListContentsQuery,
): Promise<ApiResponse<ContentListResult>> {
  try {
    const dbUser = await getCurrentDbUser();
    // Require a session but allow anonymous browse of public content?
    // For now: require a session so we can apply visibility scoping.
    await requireSession();

    const parsed = listContentsQuerySchema.safeParse(filters);
    if (!parsed.success) {
      throw AppError.validation("Invalid filters", parsed.error.flatten());
    }

    // If we know who the viewer is, apply visibility scoping. Otherwise
    // (no dbUser — e.g. pre-onboarding), fall back to the base listing
    // (which already filters to published + non-archived by default).
    if (dbUser) {
      const viewer: ViewerScope = { userId: dbUser.id, role: dbUser.role };
      const result = await contentsService.listContentsForViewer(
        viewer,
        parsed.data,
      );
      return { success: true, data: result };
    }

    const result = await contentsService.listContents(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listContentsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list contents" },
    };
  }
}

export async function searchContentsAction(
  query: SearchContentsQuery,
): Promise<ApiResponse<ContentListResult>> {
  try {
    await requireSession();
    const parsed = searchContentsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw AppError.validation("Invalid search input", parsed.error.flatten());
    }
    const result = await contentsService.searchContents(parsed.data);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("searchContentsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Search failed" },
    };
  }
}

export async function listContentVersionsAction(
  contentId: string,
): Promise<ApiResponse<Array<ContentVersion & { fileName: string | null; fileSize: number | null }>>> {
  try {
    await requireSession();
    const versions = await contentsService.listContentVersions(contentId);
    return { success: true, data: versions };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    logger.error("listContentVersionsAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not load versions" },
    };
  }
}
