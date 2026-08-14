import { ok } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * §14.1 — Health check endpoint.
 * Returns 200 if the app is alive; reports DB connectivity.
 */
export async function GET() {
  const rawDbUrl = process.env.DATABASE_URL ?? "";
  const isNeon = /^postgres(ql)?:\/\//i.test(rawDbUrl);
  const storage = process.env.STORAGE_PROVIDER ?? "r2";

  let dbStatus: "ok" | "skipped" | "error" = "skipped";

  try {
    const { getDb } = await import("@/server/db");
    const { users } = await import("@/server/db/schema");
    const db = await getDb();
    await db.select().from(users).limit(1);
    dbStatus = "ok";
  } catch (err) {
    logger.warn("Health check DB probe failed", { error: String(err) });
    dbStatus = "error";
  }

  return Response.json(
    ok({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: dbStatus, dialect: isNeon ? "neon" : "sqlite" },
        storage: { provider: storage },
        clerk: {
          configured: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
        },
      },
    }),
    { status: 200 },
  );
}
