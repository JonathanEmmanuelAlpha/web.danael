import { ok, fail, AppError, type ApiResponse } from "@/lib/api-response";
import { requireSession } from "@/lib/clerk";
import { storage } from "@/lib/storage";
import { nanoid } from "nanoid";
import { FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES, STORAGE_PATHS } from "@/lib/constants";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * §11.4 — Request a presigned upload URL.
 *
 * Query params:
 *   - category: "content" | "submission" | "avatar" | "document"
 *   - contentType: MIME type
 *   - size: file size in bytes
 *
 * Returns: { method: "PUT", uploadUrl, headers, key }
 *
 * Auth: required (any authenticated user). Role-specific limits enforced here.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    await requireSession();

    const url = new URL(req.url);
    const category = (url.searchParams.get("category") ?? "document") as
      | "content"
      | "submission"
      | "avatar"
      | "document";
    const contentType = url.searchParams.get("contentType") ?? "application/octet-stream";
    const size = Number(url.searchParams.get("size") ?? 0);

    // Validate category.
    if (!["content", "submission", "avatar", "document"].includes(category)) {
      return Response.json(
        fail("VALIDATION_ERROR", `Invalid category: ${category}`),
        { status: 422 },
      );
    }

    // Validate size.
    const maxSize = FILE_SIZE_LIMITS[category];
    if (size <= 0 || size > maxSize) {
      return Response.json(
        fail(
          "VALIDATION_ERROR",
          `File size must be between 1 byte and ${Math.round(maxSize / 1024 / 1024)}MB`,
        ),
        { status: 422 },
      );
    }

    // Validate MIME type.
    const allowed = [
      ...ALLOWED_MIME_TYPES.documents,
      ...ALLOWED_MIME_TYPES.images,
      ...ALLOWED_MIME_TYPES.videos,
    ];
    if (!allowed.includes(contentType as (typeof allowed)[number])) {
      return Response.json(
        fail("VALIDATION_ERROR", `File type not allowed: ${contentType}`),
        { status: 422 },
      );
    }

    // Build a unique key.
    const fileId = nanoid();
    const ext = contentType.split("/")[1] ?? "bin";
    const key = `${STORAGE_PATHS[category](fileId)}/${fileId}.${ext}`;

    logger.info("Presigning upload", { category, contentType, size, key });

    const result = await storage.presignUpload({
      key,
      contentType,
      maxSizeBytes: size,
      expiresIn: 120,
    });

    const response: ApiResponse<typeof result> = ok(result);
    return Response.json(response, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return Response.json(fail(err.code, err.message, err.details), {
        status: err.httpStatus,
      });
    }
    logger.error("upload-url failed", { error: String(err) });
    return Response.json(fail("INTERNAL_ERROR", "Could not generate upload URL"), {
      status: 500,
    });
  }
}
