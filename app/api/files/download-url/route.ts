import { ok, fail, AppError, type ApiResponse } from "@/lib/api-response";
import { requireSession } from "@/lib/clerk";
import { storage } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * §11.5 — Request a presigned download URL.
 *
 * Query params:
 *   - key: the storage key of the file
 *
 * Returns: { downloadUrl, key }
 */
export async function GET(req: Request): Promise<Response> {
  try {
    await requireSession();

    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return Response.json(fail("VALIDATION_ERROR", "Missing key"), { status: 422 });
    }

    const result = await storage.presignDownload({ key, expiresIn: 300 });

    const response: ApiResponse<typeof result> = ok(result);
    return Response.json(response, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return Response.json(fail(err.code, err.message, err.details), {
        status: err.httpStatus,
      });
    }
    logger.error("download-url failed", { error: String(err) });
    return Response.json(fail("INTERNAL_ERROR", "Could not generate download URL"), {
      status: 500,
    });
  }
}
