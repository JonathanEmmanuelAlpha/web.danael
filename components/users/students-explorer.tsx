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
import { StudentCard } from "./student-card";
import { CardSkeleton } from "./card-skeleton";
import {
  listStudentsAction,
  type StudentCardData,
} from "@/server/actions/users";

interface StudentsExplorerProps {
  /** School id the school_admin is acting on behalf of. */
  schoolId: string;
  /** Initial first page (server-fetched) for instant render. */
  initialItems: StudentCardData[];
  initialTotal: number;
}

const PAGE_SIZE = 12;
const COLUMNS_AT_LG = 3;

const LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Tous les niveaux" },
  { value: "6e", label: "6e" },
  { value: "5e", label: "5e" },
  { value: "4e", label: "4e" },
  { value: "3e", label: "3e" },
  { value: "2nde", label: "2nde" },
  { value: "1ere", label: "1ère" },
  { value: "Tle", label: "Terminale" },
];

/**
 * Infinite-scroll student explorer.
 *
 * Mirrors the TeachersExplorer layout but with a level filter instead of
 * a subject filter, and "strong points" stats per card.
 */
export function StudentsExplorer({
  schoolId,
  initialItems,
  initialTotal,
}: StudentsExplorerProps) {
  const t = useTranslations("Users");
  const [search, setSearch] = React.useState("");
  const [level, setLevel] = React.useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [debouncedLevel, setDebouncedLevel] = React.useState<string>("all");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedLevel(level), 200);
    return () => clearTimeout(t);
  }, [level]);

  const queryKey = React.useMemo(
    () =>
      [
        "students-explorer",
        debouncedSearch,
        debouncedLevel === "all" ? undefined : debouncedLevel,
      ] as const,
    [debouncedSearch, debouncedLevel],
  );

  const levelParam = debouncedLevel === "all" ? undefined : debouncedLevel;

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, error } =
    useInfiniteQuery({
      queryKey,
      queryFn: async ({ pageParam }) => {
        const res = await listStudentsAction({
          search: debouncedSearch || undefined,
          level: levelParam,
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
        debouncedSearch === "" && debouncedLevel === "all"
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

  const items = React.useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items),
    [data],
  );

  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(items.length / COLUMNS_AT_LG),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 380, // student cards are taller (5 stats)
    overscan: 2,
  });

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
            placeholder={t("searchStudents")}
            className="pl-9"
            aria-label={t("searchStudents")}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-[220px]" aria-label={t("filterByLevel")}>
              <SelectValue placeholder={t("filterByLevel")} />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
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
          title={t("noStudents")}
          description={String(error)}
        />
      ) : items.length === 0 && !isFetching ? (
        <EmptyState
          icon={UsersIcon}
          title={t("noStudents")}
          description={t("searchStudents")}
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
                <CardSkeleton key={i} variant="student" />
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
                    {rowItems.map((student) => (
                      <div key={student.id} role="listitem" className="h-full">
                        <StudentCard
                          student={student}
                          schoolId={schoolId}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Spinner />
              <span>{t("searchStudents")}</span>
            </div>
          )}

          {hasNextPage && !isFetchingNextPage && items.length > 0 && (
            <div className="flex justify-center py-4">
              <Button
                type="button"
                variant="brand-outline"
                onClick={() => void fetchNextPage()}
              >
                {t("searchStudents")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
