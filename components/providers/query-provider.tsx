"use client";

/**
 * TanStack Query client provider — wraps the app to enable
 * `useQuery` / `useInfiniteQuery` / `useMutation` in client components.
 *
 * Uses the singleton browser client from `@/lib/query-client`.
 */

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import type { ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Re-use the lazy singleton on the browser; fresh instance per SSR request.
  const [client] = useState(() => getQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
