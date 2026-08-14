"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookOpen, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ClassCard } from "@/components/schools/class-card";
import { getSchoolClassesAction } from "@/server/actions/schools";
import type { ClassCardData } from "@/server/services/schools";

const PAGE_SIZE = 12;

interface SchoolClassesExplorerProps {
  schoolId: string;
  /** First page (server-fetched) used to seed the infinite query. */
  initialPage: {
    items: ClassCardData[];
    total: number;
    page: number;
    hasMore: boolean;
  };
}

/**
 * §5.3 — Classes explorer for a school, with infinite scroll + virtualization.
 *
 * Same pattern as `<SchoolsExplorer>`: server-fetched first page, debounced
 * search, TanStack Query infinite query, `@tanstack/react-virtual` for the
 * long list (row-based: each virtual row = one grid row of N cards),
 * IntersectionObserver sentinel for auto-loading.
 */
export function SchoolClassesExplorer({
  schoolId,
  initialPage,
}: SchoolClassesExplorerProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const queryParams = React.useMemo(
    () => ({
      schoolId,
      search: debouncedSearch.trim() || undefined,
    }),
    [schoolId, debouncedSearch],
  );

  const queryKey = React.useMemo(
    () => ["schools", "classes", queryParams] as const,
    [queryParams],
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const result = await getSchoolClassesAction({
        schoolId,
        search: queryParams.search,
        page: pageParam,
        pageSize: PAGE_SIZE,
      });
      if (!result.success) {
        throw new Error(result.error?.message ?? "Failed to load classes");
      }
      if (!result.data) {
        throw new Error("Failed to load classes");
      }
      return result.data;
    },
    initialPageParam: 1,
    initialData: {
      pages: [initialPage],
      pageParams: [1],
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const allClasses = React.useMemo(() => {
    return data?.pages.flatMap((p) => p.items) ?? [];
  }, [data]);

  // ── Responsive column count ─────────────────────────────────────
  const columns = useColumns();

  // ── Row-based virtualization ────────────────────────────────────
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const rowCount = Math.ceil(allClasses.length / columns);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320,
    overscan: 2,
  });

  // ── Infinite scroll sentinel ────────────────────────────────────
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (!hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const totalItems = data?.pages.at(-1)?.total ?? allClasses.length;
  const isEmpty = !isFetching && allClasses.length === 0;
  const hasFilters = Boolean(debouncedSearch);

  function handleResetFilters() {
    setSearch("");
  }

  const gridColsClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-6">
      {/* ── Search bar ────────────────────────────────────────── */}
      <div className="glass sticky top-4 z-10 rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchClasses")}
              className="pl-9"
              aria-label={t("searchClasses")}
            />
          </div>
          {(hasFilters || totalItems > 0) && (
            <span className="text-xs text-muted-foreground">
              {totalItems > 0
                ? `${totalItems} ${t("members").toLowerCase()}`
                : ""}
            </span>
          )}
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 gap-1 text-xs"
            >
              <X className="size-3" />
              {tCommon("reset")}
            </Button>
          </div>
        )}
      </div>

      {/* ── List ───────────────────────────────────────────────── */}
      {isEmpty ? (
        <EmptyState
          icon={BookOpen}
          title={t("noClasses")}
          description={t("noSchoolsHint")}
        />
      ) : isError ? (
        <EmptyState
          icon={BookOpen}
          title={t("noClasses")}
          description={
            error instanceof Error ? error.message : t("noSchoolsHint")
          }
          action={{ label: tCommon("retry"), onClick: () => void refetch() }}
        />
      ) : (
        <div
          ref={parentRef}
          className="max-h-[2400px] overflow-y-auto scrollbar-thin pr-1"
        >
          <div
            className="relative w-full"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const startIdx = virtualRow.index * columns;
              const rowItems = allClasses.slice(startIdx, startIdx + columns);
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  className="absolute left-0 top-0 w-full"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className={`grid gap-4 pb-4 ${gridColsClass}`}>
                    {rowItems.map((cls) => (
                      <ClassCard key={cls.id} cls={cls} />
                    ))}
                    {Array.from({
                      length: columns - rowItems.length,
                    }).map((_, i) => (
                      <div key={`pad-${i}`} aria-hidden />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Loading skeleton while fetching next page */}
          {isFetchingNextPage && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <ClassCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1 w-full" aria-hidden />

          {/* End-of-list indicator */}
          {!hasNextPage && allClasses.length > 0 && !isFetchingNextPage && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {tCommon("noMoreResults")}
            </p>
          )}

          {/* Manual "Load more" fallback */}
          {hasNextPage && !isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => void fetchNextPage()}
              >
                {t("loadingMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────── */

function ClassCardSkeleton() {
  return (
    <div
      className="glass-card flex h-full flex-col gap-4 rounded-xl p-5"
      aria-hidden
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-3" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface-3" />
        </div>
        <div className="size-10 shrink-0 animate-pulse rounded-xl bg-surface-3" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-12 animate-pulse rounded-md bg-surface-3" />
        <div className="h-5 w-12 animate-pulse rounded-md bg-surface-3" />
        <div className="h-5 w-16 animate-pulse rounded-md bg-surface-3" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2/60 p-2"
          >
            <div className="mx-auto size-3.5 animate-pulse rounded bg-surface-3" />
            <div className="mx-auto h-3 w-8 animate-pulse rounded bg-surface-3" />
            <div className="mx-auto h-2 w-10 animate-pulse rounded bg-surface-3" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex gap-2 pt-2">
        <div className="h-8 flex-1 animate-pulse rounded-md bg-surface-3" />
        <div className="h-8 flex-1 animate-pulse rounded-md bg-surface-3" />
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function useColumns(): number {
  const [columns, setColumns] = React.useState(3);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sm = window.matchMedia("(min-width: 640px)");
    const xl = window.matchMedia("(min-width: 1280px)");

    const update = () => {
      if (xl.matches) setColumns(3);
      else if (sm.matches) setColumns(2);
      else setColumns(1);
    };
    update();
    sm.addEventListener("change", update);
    xl.addEventListener("change", update);
    return () => {
      sm.removeEventListener("change", update);
      xl.removeEventListener("change", update);
    };
  }, []);

  return columns;
}
