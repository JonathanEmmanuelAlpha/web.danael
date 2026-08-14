import { ok, fail, AppError } from "@/lib/api-response";
import { requireSession } from "@/lib/clerk";
import { logger } from "@/lib/logger";
import { recordLearningEventsAction } from "@/server/actions/learning";
import type { LearningEventDraft } from "@/stores/learning-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Adaptive Learning Loop — flush endpoint.
 *
 * POST /api/learning/flush
 * Body: { events: LearningEventDraft[] }
 *
 * Used by two client-side triggers:
 *  1. `useLearningEventFlusher` `beforeunload` handler via `navigator.sendBeacon`
 *     (sends a JSON Blob with Content-Type: application/json)
 *  2. Any client code that wants to force a synchronous flush outside the
 *     30s debounce / visibilitychange flow (e.g. before signing out)
 *
 * Auth: any authenticated user (the underlying server action resolves the
 * studentId from the session).
 *
 * Caps the batch at 200 events to prevent abuse.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    await requireSession();

    // Read as text first so we can support both `application/json` bodies
    // (fetch) and `text/plain` (some sendBeacon callers). We then JSON.parse
    // manually.
    const raw = await req.text();
    let body: { events?: unknown };
    try {
      body = raw ? (JSON.parse(raw) as { events?: unknown }) : {};
    } catch {
      return Response.json(
        fail("VALIDATION_ERROR", "Invalid JSON body"),
        { status: 422 },
      );
    }

    const events = Array.isArray(body?.events)
      ? (body.events as LearningEventDraft[])
      : [];

    if (events.length === 0) {
      return Response.json(ok({ saved: 0 }), { status: 200 });
    }

    if (events.length > 200) {
      return Response.json(
        fail(
          "VALIDATION_ERROR",
          `Too many events in a single batch (max 200, got ${events.length})`,
        ),
        { status: 422 },
      );
    }

    const result = await recordLearningEventsAction(events);
    if (!result.success) {
      return Response.json(result, { status: 500 });
    }

    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return Response.json(
        fail(err.code, err.message, err.details),
        { status: err.httpStatus },
      );
    }
    logger.error("learning/flush failed", { error: String(err) });
    return Response.json(
      fail("INTERNAL_ERROR", "Could not flush learning events"),
      { status: 500 },
    );
  }
}
