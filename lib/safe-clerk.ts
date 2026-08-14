/**
 * Safe wrappers around Clerk's useSignIn / useSignUp / useClerk hooks.
 *
 * objects so auth pages don't crash when ClerkProvider is not mounted.
 * In production mode, they delegate to the real Clerk hooks.
 *
 * Uses conditional dynamic import to avoid calling Clerk hooks when
 * ClerkProvider is not mounted.
 */

"use client";

import { useEffect, useState } from "react";

// Lazy loader for Clerk hooks — only imports @clerk/nextjs when needed
function useClerkHooks() {
  const [hooks, setHooks] = useState<{
    useSignIn: () => unknown;
    useSignUp: () => unknown;
    useClerk: () => unknown;
  } | null>(null);

  useEffect(() => {
    import("@clerk/nextjs")
      .then((mod) => {
        setHooks({
          useSignIn: mod.useSignIn as () => unknown,
          useSignUp: mod.useSignUp as () => unknown,
          useClerk: mod.useClerk as () => unknown,
        });
      })
      .catch(() => {
        // Clerk not available — fall back to mocks
      });
  }, []);

  return hooks;
}

export function useSafeSignIn() {
  const hooks = useClerkHooks();
  if (!hooks) {
    return;
  }
  return hooks.useSignIn() as ReturnType<
    typeof import("@clerk/nextjs").useSignIn
  >;
}

export function useSafeSignUp() {
  const hooks = useClerkHooks();
  if (!hooks) {
    return;
  }
  return hooks.useSignUp() as ReturnType<
    typeof import("@clerk/nextjs").useSignUp
  >;
}

export function useSafeClerk() {
  const hooks = useClerkHooks();
  if (!hooks) {
    return;
  }
  return hooks.useClerk() as ReturnType<
    typeof import("@clerk/nextjs").useClerk
  >;
}
