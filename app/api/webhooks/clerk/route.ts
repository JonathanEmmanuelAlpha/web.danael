import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { getDb } from "@/server/db";
import { users, userPoints } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { WebhookEvent } from "@clerk/backend";

/**
 * §9.2 — Clerk webhook → sync Neon/SQLite `users` table.
 *
 * Handles: user.created, user.updated, user.deleted.
 * Idempotent: re-running `user.created` for the same clerkId upserts.
 */
export async function POST(req: Request) {
  let evt: WebhookEvent;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    logger.warn("Webhook signature verification failed", { error: String(err) });
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid signature" } },
      { status: 400 },
    );
  }

  const eventType = evt.type;
  const data = evt.data as WebhookEvent["data"] & {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    phone_numbers?: Array<{ phone_number: string }>;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    deleted?: boolean;
  };

  logger.info("Clerk webhook received", { eventType, clerkId: data.id });

  try {
    const db = await getDb();

    switch (eventType) {
      case "user.created":
      case "user.updated": {
        const clerkId = data.id;
        const email = data.email_addresses?.[0]?.email_address ?? "";
        const phone = data.phone_numbers?.[0]?.phone_number ?? null;
        const firstName = data.first_name ?? null;
        const lastName = data.last_name ?? null;
        const avatarUrl = data.image_url ?? null;

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, clerkId))
          .limit(1);

        if (existing.length > 0) {
          // Update synced fields. role / onboardingCompleted are NOT overwritten
          // — they are set by our own onboarding flow.
          await db
            .update(users)
            .set({
              email,
              phone,
              firstName,
              lastName,
              avatarUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.clerkId, clerkId));
          logger.info("Webhook: updated user", { clerkId, email });
        } else {
          // Insert new user with default role 'student'.
          await db.insert(users).values({
            clerkId,
            email,
            phone,
            firstName,
            lastName,
            avatarUrl,
            role: "student",
            onboardingCompleted: false,
          });

          // Fetch the inserted row to get the UUID, then create the gamification row.
          const [inserted] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.clerkId, clerkId))
            .limit(1);

          if (inserted) {
            await db
              .insert(userPoints)
              .values({ userId: inserted.id, totalXp: 0, level: 1 })
              .catch((err) => {
                // Idempotency: ignore unique constraint violation if the row
                // already exists (e.g. webhook replayed).
                logger.warn("userPoints insert skipped", {
                  clerkId,
                  error: String(err),
                });
              });
          }

          logger.info("Webhook: created user + points row", { clerkId, email });
        }
        break;
      }
      case "user.deleted": {
        if (data.deleted) {
          // Soft delete: keep the row for audit but anonymize PII.
          await db
            .update(users)
            .set({
              email: `deleted+${data.id}@danael.local`,
              phone: null,
              firstName: null,
              lastName: null,
              avatarUrl: null,
              updatedAt: new Date(),
            })
            .where(eq(users.clerkId, data.id))
            .catch((err) => {
              logger.warn("Webhook: user.delete failed (row may not exist)", {
                clerkId: data.id,
                error: String(err),
              });
            });
          logger.info("Webhook: anonymized deleted user", { clerkId: data.id });
        }
        break;
      }
      default:
        logger.info("Webhook: unhandled event", { eventType });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    logger.error("Webhook handler failed", { eventType, error: String(err) });
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Webhook failed" } },
      { status: 500 },
    );
  }
}
