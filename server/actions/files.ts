"use server";

/**
 * §11 — File services (storage metadata persistence).
 *
 * The upload flow is:
 *   1. Client → POST /api/files/upload-url  → gets presigned PUT URL + key
 *   2. Client → PUT file directly to R2/Uploadthing
 *   3. Client → confirmUploadAction(key, metadata) → creates `files` row
 *   4. Client → download via /api/files/download-url?key=...
 */

import { getDb } from "@/server/db";
import { files } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/clerk";
import { storage } from "@/lib/storage";
import { AppError, type ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES } from "@/lib/constants";

export interface FileRecord {
  id: string;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  bucket: string;
  status: string;
}

export interface ConfirmUploadInput {
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  category: "content" | "submission" | "avatar" | "document";
  fileUrl?: string;
}

/**
 * §11.4 step 5 — Confirm that a file was uploaded to storage.
 * Creates the `files` row so the file can be linked to a business entity.
 */
export async function confirmUploadAction(
  input: ConfirmUploadInput,
): Promise<ApiResponse<FileRecord>> {
  try {
    const user = await requireDbUser();

    // Validate input
    if (
      !input.key ||
      !input.originalName ||
      !input.contentType ||
      input.size <= 0
    ) {
      throw AppError.validation("Missing required file metadata");
    }

    const db = await getDb();

    // Check for duplicate key (idempotency)
    const existing = await db
      .select()
      .from(files)
      .where(eq(files.key, input.key))
      .limit(1);

    if (existing.length > 0) {
      return { success: true, data: existing[0] as unknown as FileRecord };
    }

    // Create the file record
    const [created] = await db
      .insert(files)
      .values({
        ownerId: user.id,
        bucket: storage.provider,
        key: input.key,
        originalName: input.originalName,
        contentType: input.contentType,
        size: input.size,
        status: "ready",
        fileUrl: input.fileUrl,
      })
      .returning();

    logger.info("File confirmed", {
      fileId: created?.id,
      key: input.key,
      userId: user.id,
    });

    return { success: true, data: created as unknown as FileRecord };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("confirmUploadAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not confirm upload" },
    };
  }
}

/**
 * Delete a file (storage object + DB row).
 * Only the owner or an admin can delete.
 */
export async function deleteFileAction(
  fileId: string,
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const user = await requireDbUser();
    const db = await getDb();

    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) throw AppError.notFound("File not found");

    // Permission: owner or platform_admin
    if (file.ownerId !== user.id && user.role !== "platform_admin") {
      throw AppError.forbidden("You can only delete your own files");
    }

    // Delete from storage provider (best-effort — don't fail if the object
    // is already gone).
    await storage.deleteObject(file.key).catch((err) => {
      logger.warn("Storage delete failed (non-blocking)", {
        key: file.key,
        error: String(err),
      });
    });

    // Delete the DB row
    await db.delete(files).where(eq(files.id, fileId));

    logger.info("File deleted", { fileId, userId: user.id });
    revalidatePath("/library");

    return { success: true, data: { deleted: true } };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("deleteFileAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not delete file" },
    };
  }
}

/**
 * List files owned by the current user.
 */
export async function listMyFilesAction(): Promise<ApiResponse<FileRecord[]>> {
  try {
    const user = await requireDbUser();
    const db = await getDb();

    const rows = await db
      .select()
      .from(files)
      .where(eq(files.ownerId, user.id));

    return { success: true, data: rows as unknown as FileRecord[] };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        success: false,
        error: { code: err.code, message: err.message },
      };
    }
    logger.error("listMyFilesAction failed", { error: String(err) });
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Could not list files" },
    };
  }
}
