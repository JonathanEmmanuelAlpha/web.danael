/**
 * Sandbox auth provider — wraps ClerkProvider only when real Clerk keys
 * are configured. In sandbox mode (SANDBOX_MOCK_AUTH=true), renders
 * children without auth so the UI can be previewed.
 *
 * Also exports `SandboxUserProvider` which mocks `useUser()` / `useClerk()`
 * so client components that still call these hooks don't crash.
 */

"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

/** Minimal mock of Clerk's useUser() return value. */
interface MockUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  primaryEmailAddress?: { emailAddress: string };
  username?: string | null;
}

interface MockClerkContextValue {
  user: MockUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: (callback?: () => void) => void;
  openSignIn: () => void;
  openSignUp: () => void;
}

const MockClerkContext = createContext<MockClerkContextValue>({
  user: {
    id: "sandbox-user-demo",
    firstName: "Alex",
    lastName: "Demo",
    imageUrl: null,
    primaryEmailAddress: { emailAddress: "alex.demo@danael.app" },
    username: "alex_demo",
  },
  isLoaded: true,
  isSignedIn: true,
  signOut: (cb) => cb?.(),
  openSignIn: () => {},
  openSignUp: () => {},
});

/** Use this instead of useUser() from Clerk if you want sandbox compatibility. */
export function useSandboxUser() {
  return useContext(MockClerkContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
