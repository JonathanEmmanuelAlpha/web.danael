"use server";

/**
 * §5.2 — Client-callable auth status.
 *
 * Client components (sign-in, sign-up, sso-callback, reset-password) cannot
 * import `getCurrentDbUser` directly (it uses node:fs via the DB layer).
 * This server action bridges that gap.
 */

import { getCurrentDbUser, getSessionUser } from "@/lib/clerk";
import type { ApiResponse } from "@/lib/api-response";
import type { UserRole } from "@/types";

export interface AuthStatus {
  authenticated: boolean;
  onboardingCompleted: boolean;
  role?: UserRole;
}

export async function getAuthStatusAction(): Promise<ApiResponse<AuthStatus>> {
  try {
    const session = await getSessionUser();
    if (!session) {
      return { success: true, data: { authenticated: false, onboardingCompleted: false } };
    }
    const dbUser = await getCurrentDbUser();
    return {
      success: true,
      data: {
        authenticated: true,
        onboardingCompleted: dbUser?.onboardingCompleted ?? false,
        role: dbUser?.role,
      },
    };
  } catch {
    return {
      success: true,
      data: { authenticated: false, onboardingCompleted: false },
    };
  }
}
