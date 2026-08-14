import { getCurrentDbUser, getSessionUser } from "@/lib/clerk";
import { logger } from "@/lib/logger";
import { subscribeLive, type LiveNotificationPayload } from "@/server/services/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * §15.1 — Server-Sent Events endpoint for live notifications.
 *
 * Auth required (reads session via Clerk).
 *
 * Sends:
 *  - heartbeat every 30s (`event: ping`)
 *  - `event: notification` with JSON payload when a new notification is pushed
 *
 * Connection lifecycle:
 *  - closed when the client disconnects (request signal abort)
 *  - the in-memory subscriber is removed on close
 *
 * Phase 15 will swap the in-memory pub/sub for Redis pub/sub.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSessionUser();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return new Response("User profile not found", { status: 404 });
  }
  const userId = dbUser.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let maxLifetime: ReturnType<typeof setTimeout> | null = null;
      let unsubscribe: (() => void) | null = null;
      let abortListener: (() => void) | null = null;

      function safeSend(chunk: string): boolean {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch (err) {
          logger.debug("SSE send failed", { error: String(err) });
          closed = true;
          return false;
        }
      }

      function cleanup(): void {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (maxLifetime) clearTimeout(maxLifetime);
        if (unsubscribe) unsubscribe();
        if (abortListener) {
          req.signal.removeEventListener("abort", abortListener);
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        logger.debug("SSE connection closed", { userId });
      }

      // Initial hello event so the client knows the connection is established.
      safeSend(
        `event: hello\ndata: ${JSON.stringify({ userId, ts: Date.now() })}\n\n`,
      );

      // Heartbeat every 30s.
      heartbeat = setInterval(() => {
        safeSend(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      }, 30_000);

      // Live subscriber callback.
      unsubscribe = subscribeLive(userId, (n: LiveNotificationPayload) => {
        const payload = {
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          metadata: n.metadata,
          createdAt: n.createdAt.toISOString(),
        };
        safeSend(
          `event: notification\ndata: ${JSON.stringify(payload)}\n\n`,
        );
      });

      // Detect client disconnect via the request signal.
      abortListener = cleanup;
      req.signal.addEventListener("abort", cleanup);

      // Force-close after 5 minutes to keep the proxy happy (clients reconnect
      // automatically).
      maxLifetime = setTimeout(cleanup, 5 * 60 * 1000);
    },
    cancel() {
      logger.debug("SSE stream cancelled by client", { userId });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
