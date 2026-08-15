"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Building2, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { SchoolCard } from "@/components/schools/school-card";
import { SchoolCardSkeleton } from "@/components/schools/school-card-skeleton";
import { listSchoolsFTSAction } from "@/server/actions/schools";
import type { SchoolCardData } from "@/server/services/schools";

const PAGE_SIZE = 12;

interface SchoolsExplorerProps {
  /** First page (server-fetched) used to seed the infinite query. */
  initialPage: {
    items: SchoolCardData[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

/**
 * §5.3 — Schools explorer with infinite scroll + virtualization.
 *
 * - Search input (debounced 300ms).
 * - Filters: city (free text) + type (Select).
 * - `useInfiniteQuery` from TanStack Query handles pagination.
 * - `@tanstack/react-virtual` virtualizes the long list of cards using a
 *   **row-based** layout (each virtual row = one grid row of N cards).
 *   The number of columns is detected from the viewport via matchMedia
 *   (1 on mobile / 2 on sm / 3 on xl) so virtualization matches the actual
 *   grid layout.
 * - Initial page comes from the server component (no client-side fetch on
 *   first render).
 * - A sentinel `<div ref={sentinelRef}>` + IntersectionObserver auto-loads
 *   the next page when scrolled into view.
 * - Skeletons (3 placeholder cards) appear while fetching the next page.
 * - Empty state when the result set is empty.
 */
export function SchoolsExplorer({ initialPage }: SchoolsExplorerProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");

  const [search, setSearch] = React.useState("");
  const [city, setCity] = React.useState("");
  const [type, setType] = React.useState<string>("");

  // Debounced search value (300ms).
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedCity = useDebouncedValue(city, 300);

  const queryParams = React.useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      city: debouncedCity.trim() || undefined,
      type: type || undefined,
    }),
    [debouncedSearch, debouncedCity, type],
  );

  const queryKey = React.useMemo(
    () => ["schools", "fts", queryParams] as const,
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
      const result = await listSchoolsFTSAction({
        ...queryParams,
        page: pageParam,
        pageSize: PAGE_SIZE,
      });
      if (!result.success) {
        throw new Error(result.error?.message ?? "Failed to load schools");
      }
      if (!result.data) {
        throw new Error("Failed to load schools");
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

  // Flatten all pages into a single list of schools.
  const allSchools = React.useMemo(() => {
    return data?.pages.flatMap((p) => p.items) ?? [];
  }, [data]);

  // -- Responsive column count -------------------------------------
  // 1 on mobile / 2 on sm (≥640px) / 3 on xl (≥1280px).
  const columns = useColumns();

  // -- Row-based virtualization ------------------------------------
  // Each virtual "row" represents a horizontal grid row of `columns` cards.
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const rowCount = Math.ceil(allSchools.length / columns);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 460,
    overscan: 2,
  });

  // -- Infinite scroll sentinel (IntersectionObserver) -------------
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

  const totalItems = data?.pages.at(-1)?.total ?? allSchools.length;
  const isEmpty = !isFetching && allSchools.length === 0;
  const hasFilters = Boolean(debouncedSearch || debouncedCity || type);

  function handleResetFilters() {
    setSearch("");
    setCity("");
    setType("");
  }

  // Build the column class string based on the detected column count.
  const gridColsClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-6">
      {/* -- Search + filter bar ---------------------------------- */}
      <div className="glass sticky top-4 z-10 rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchSchools")}
              className="pl-9"
              aria-label={t("searchSchools")}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("filterByCity")}
                className="pl-9 sm:w-[200px]"
                aria-label={t("filterByCity")}
              />
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal
                className="size-4 text-muted-foreground"
                aria-hidden
              />
              <Select
                value={type}
                onValueChange={(v) => setType(v === "all" ? "" : v)}
              >
                <SelectTrigger
                  className="sm:w-[180px]"
                  aria-label={t("filterByType")}
                >
                  <SelectValue placeholder={t("allTypes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allTypes")}</SelectItem>
                  <SelectItem value="public">{t("types.public")}</SelectItem>
                  <SelectItem value="private">{t("types.private")}</SelectItem>
                  <SelectItem value="parochial">
                    {t("types.parochial")}
                  </SelectItem>
                  <SelectItem value="other">{t("types.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Result count + reset */}
        {(hasFilters || totalItems > 0) && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {totalItems > 0
                ? `${totalItems} ${t("members").toLowerCase()}`
                : ""}
            </span>
            {hasFilters && (
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
            )}
          </div>
        )}
      </div>

      {/* -- List ------------------------------------------------- */}
      {isEmpty ? (
        <EmptyState
          icon={Building2}
          title={t("noSchools")}
          description={t("noSchoolsHint")}
        />
      ) : isError ? (
        <EmptyState
          icon={Building2}
          title={t("noSchools")}
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
              const rowItems = allSchools.slice(startIdx, startIdx + columns);
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
                  <div className={`grid gap-5 pb-5 ${gridColsClass}`}>
                    {rowItems.map((school) => (
                      <SchoolCard key={school.id} school={school} />
                    ))}
                    {/* Pad the row with empty divs so the grid stays aligned */}
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
            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <SchoolCardSkeleton />
              <SchoolCardSkeleton />
              <SchoolCardSkeleton />
            </div>
          )}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1 w-full" aria-hidden />

          {/* End-of-list indicator */}
          {!hasNextPage && allSchools.length > 0 && !isFetchingNextPage && (
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

/* -- Helpers ------------------------------------------------------ */

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms
 * have elapsed without changes.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

/**
 * Detect the number of grid columns based on the viewport.
 *
 * Matches the Tailwind breakpoints used by `SchoolCard`:
 *   - < 640px  → 1 column (mobile)
 *   - ≥ 640px  → 2 columns (sm)
 *   - ≥ 1280px → 3 columns (xl)
 *
 * Returns `3` as a SSR-friendly default (the value is recomputed on the
 * client after mount via `useEffect`).
 */
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
