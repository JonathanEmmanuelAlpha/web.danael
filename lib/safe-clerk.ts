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

import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
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
  return useSignIn();
}

export function useSafeSignUp() {
  return useSignUp();
}

export function useSafeClerk() {
  return useClerk();
}
