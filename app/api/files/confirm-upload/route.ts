import { fail, AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { confirmUploadAction } from "@/server/actions/files";

export const dynamic = "force-dynamic";

/**
 * §11.4 step 5 — Confirm that a file was uploaded to storage.
 *
 * POST body: { key, originalName, contentType, size, category }
 * Returns: { id, key, originalName, contentType, size, bucket, status }
 *
 * Idempotent: if the key already exists, returns the existing record.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      key: string;
      originalName: string;
      contentType: string;
      size: number;
      category: "content" | "submission" | "avatar" | "document";
      fileUrl?: string;
    };

    const response = await confirmUploadAction(body);
    return Response.json(response, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return Response.json(fail(err.code, err.message, err.details), {
        status: err.httpStatus,
      });
    }
    logger.error("confirm-upload failed", { error: String(err) });
    return Response.json(fail("INTERNAL_ERROR", "Could not confirm upload"), {
      status: 500,
    });
  }
}
