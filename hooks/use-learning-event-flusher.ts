"use client";

/**
 * useLearningEventFlusher — registers the page-level listeners that
 * trigger a flush of the learning events buffer:
 *
 *  1. `visibilitychange` (tab hidden) → flushEvents()
 *  2. `beforeunload` (page close) → navigator.sendBeacon('/api/learning/flush')
 *
 * Mount this hook once near the root of the authenticated dashboard
 * (e.g. inside <DashboardShell /> or a dedicated <LearningStoreHydrator />).
 *
 * The 30s debounce after each `addEvent` is handled inside the store
 * itself (see `scheduleFlush`); this hook only covers the two
 * page-lifecycle triggers that the in-store timer can't catch.
 */

import { useEffect } from "react";
import { useLearningStore } from "@/stores/learning-store";

export function useLearningEventFlusher(): void {
  const flushEvents = useLearningStore((s) => s.flushEvents);

  useEffect(() => {
    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        void flushEvents();
      }
    };

    const handleBeforeUnload = (): void => {
      const events = useLearningStore.getState().events;
      if (events.length === 0) return;

      // sendBeacon is the only reliable way to ship data during unload:
      // fetch/XHR may be cancelled by the browser. We send a JSON Blob so
      // the route handler can parse it with req.json().
      try {
        const blob = new Blob([JSON.stringify({ events })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/learning/flush", blob);
        // Clear the buffer optimistically (beacon is fire-and-forget,
        // we can't await it, but we also don't want a duplicate flush
        // from the debounce timer or visibility handler).
        useLearningStore.setState({ events: [] });
      } catch {
        // If sendBeacon is unavailable, fall back to a best-effort fetch
        // (will likely be cancelled, but worth trying).
        void flushEvents();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [flushEvents]);
}
