import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";

/**
 * §5.2 — Resolve the correct landing route after a successful authentication.
 *
 * Logic:
 *  1. If the DB user doesn't exist yet (webhook pending), go to /onboarding/role.
 *  2. If onboarding is incomplete, go to /onboarding/role (resume).
 *  3. Otherwise, go to /dashboard.
 *
 * This is the SERVER-side variant (used by Server Components / route handlers).
 * For client-side redirects after Clerk client APIs, use router.push directly
 * with the result of getCurrentDbUser().
 */
export async function resolvePostAuthRoute(): Promise<string> {
  const dbUser = await getCurrentDbUser();
  if (!dbUser || !dbUser.onboardingCompleted) {
    return "/onboarding/role";
  }
  return "/dashboard";
}

/**
 * Server-side redirect helper: resolves the route AND redirects.
 */
export async function redirectAfterAuth(): Promise<never> {
  const route = await resolvePostAuthRoute();
  redirect(route);
}
