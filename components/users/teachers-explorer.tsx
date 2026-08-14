"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SearchIcon, SlidersHorizontal, Users as UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { TeacherCard } from "./teacher-card";
import { CardSkeleton } from "./card-skeleton";
import { listTeachersAction, type TeacherCardData } from "@/server/actions/users";

interface TeachersExplorerProps {
  /** School id the school_admin is acting on behalf of. */
  schoolId: string;
  /** Initial first page (server-fetched) for instant render. */
  initialItems: TeacherCardData[];
  initialTotal: number;
  /** Available subjects for the filter dropdown. */
  subjects: Array<{ id: string; name: string }>;
}

const PAGE_SIZE = 12;

/**
 * Infinite-scroll teacher explorer.
 *
 *  - Search field (debounced 300 ms) + subject filter
 *  - Virtualized masonry-ish grid via @tanstack/react-virtual
 *  - Server action: `listTeachersAction`
 *  - Server passes the first page (initialItems) so the client boots
 *    without a flash of skeleton.
 */
export function TeachersExplorer({
  schoolId,
  initialItems,
  initialTotal,
  subjects,
}: TeachersExplorerProps) {
  const t = useTranslations("Users");
  const [search, setSearch] = React.useState("");
  const [subject, setSubject] = React.useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [debouncedSubject, setDebouncedSubject] = React.useState<string>("all");

  // Debounce search input (300 ms).
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Debounce subject selection (200 ms) so rapid switching doesn't spam.
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSubject(subject), 200);
    return () => clearTimeout(t);
  }, [subject]);

  const queryKey = React.useMemo(
    () =>
      [
        "teachers-explorer",
        debouncedSearch,
        debouncedSubject === "all" ? undefined : debouncedSubject,
      ] as const,
    [debouncedSearch, debouncedSubject],
  );

  const subjectParam =
    debouncedSubject === "all"
      ? undefined
      : subjects.find((s) => s.id === debouncedSubject)?.name;

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, error } =
    useInfiniteQuery({
      queryKey,
      queryFn: async ({ pageParam }) => {
        const res = await listTeachersAction({
          search: debouncedSearch || undefined,
          subject: subjectParam,
          page: pageParam,
          pageSize: PAGE_SIZE,
        });
        if (!res.success) {
          throw new Error(res.error.message);
        }
        return res.data;
      },
      initialPageParam: 1,
      initialData:
        // Pre-seed the first page using server-fetched data (only when
        // the filters match the initial server-side query).
        debouncedSearch === "" && debouncedSubject === "all"
          ? {
              pages: [
                {
                  items: initialItems,
                  total: initialTotal,
                  page: 1,
                  hasMore: 1 * PAGE_SIZE < initialTotal,
                },
              ],
              pageParams: [1],
            }
          : undefined,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.page + 1 : undefined,
    });

  // Flatten paginated items into a single list for virtualization.
  const items = React.useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items),
    [data],
  );

  // Virtualize the flattened list. Each row is a horizontal grid row that
  // holds up to 3 cards (responsive: 1 → 2 → 3 columns).
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(items.length / COLUMNS_AT_LG),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320, // row height (incl. gap)
    overscan: 2,
  });

  // Load more when the user scrolls near the bottom.
  React.useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (remaining < 400) {
        void fetchNextPage();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchTeachers")}
            className="pl-9"
            aria-label={t("searchTeachers")}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-[220px]" aria-label={t("filterBySubject")}>
              <SelectValue placeholder={t("filterBySubject")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterBySubject")}</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List / Empty / Loading */}
      {error ? (
        <EmptyState
          icon={UsersIcon}
          title={t("noTeachers")}
          description={String(error)}
        />
      ) : items.length === 0 && !isFetching ? (
        <EmptyState
          icon={UsersIcon}
          title={t("noTeachers")}
          description={t("searchTeachers")}
        />
      ) : (
        <div
          ref={parentRef}
          className="scrollbar-thin max-h-[calc(100vh-260px)] overflow-y-auto pr-1"
          role="list"
          aria-busy={isFetching}
        >
          {items.length === 0 && isFetching ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
                width: "100%",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const start = vRow.index * COLUMNS_AT_LG;
                const rowItems = items.slice(start, start + COLUMNS_AT_LG);
                return (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vRow.start}px)`,
                    }}
                    className="grid gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {rowItems.map((teacher) => (
                      <div key={teacher.id} role="listitem" className="h-full">
                        <TeacherCard
                          teacher={teacher}
                          schoolId={schoolId}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading more indicator */}
          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Spinner />
              <span>{t("searchTeachers")}</span>
            </div>
          )}

          {/* Load-more manual trigger (in case virtualizer hasn't fired) */}
          {hasNextPage && !isFetchingNextPage && items.length > 0 && (
            <div className="flex justify-center py-4">
              <Button
                type="button"
                variant="brand-outline"
                onClick={() => void fetchNextPage()}
              >
                {t("searchTeachers")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const COLUMNS_AT_LG = 3;
