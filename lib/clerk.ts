/**
 * §9.1 — Clerk server-side helpers (thin wrapper around @clerk/nextjs/server).
 *
 * Keeps the rest of the codebase decoupled from Clerk specifics —
 * if the API changes, only this file needs updating.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { User } from "@/server/db/schema";

export interface SessionUser {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

/**
 * Returns the Clerk session user (or null if unauthenticated).
 * Use this in route handlers / server actions.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth();
    if (!session.userId) return null;

    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses.at(0)?.emailAddress ?? "";

    return {
      clerkId: session.userId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
    };
  } catch (err) {
    logger.error("getSessionUser failed", { error: String(err) });
    return null;
  }
}

/**
 * Returns the Danaël database user row corresponding to the current Clerk session.
 * Use this for RBAC checks and to fetch the `role`.
 */
export async function getCurrentDbUser(): Promise<User | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, session.clerkId))
    .limit(1);

  return rows.at(0) ?? null;
}

export async function getCurrentDbUserByClerkId(
  clerkId: string,
): Promise<User | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  return rows.at(0) ?? null;
}

/**
 * Requires an authenticated session; throws AppError.unauthenticated otherwise.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    const { AppError } = await import("@/lib/api-response");
    throw AppError.unauthenticated();
  }
  return session;
}

/**
 * Requires an authenticated session AND a database user row.
 */
export async function requireDbUser(): Promise<User> {
  await requireSession();
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    const { AppError } = await import("@/lib/api-response");
    throw AppError.notFound(
      "User profile not found. Please complete onboarding.",
    );
  }
  return dbUser;
}

/**
 * Convert a DB user row into a UserSessionData object suitable for
 * hydrating the Zustand user store on the client.
 *
 * Use this in server components / layouts to pass hydrated user data:
 *   const user = await requireDbUser();
 *   <DashboardShell user={toUserSessionData(user)} ...>
 */
export function toUserSessionData(
  user: User,
): import("@/stores/user-store").UserSessionData {
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.avatarUrl,
    avatarUrl: user.avatarUrl,
    role: user.role as import("@/stores/user-store").UserSessionData["role"],
    level: user.level,
    series: user.series,
    onboardingStatus:
      user.onboardingStatus as import("@/stores/user-store").UserSessionData["onboardingStatus"],
    language: user.language,
    theme: user.theme,
  };
}
