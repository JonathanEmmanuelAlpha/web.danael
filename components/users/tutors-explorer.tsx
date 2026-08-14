"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { GraduationCap, SearchIcon, SlidersHorizontal, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { TutorCard } from "./tutor-card";
import { CardSkeleton } from "./card-skeleton";
import { listTutorsAction, type TutorCardData } from "@/server/actions/users";

interface TutorsExplorerProps {
  /** Initial first page (server-fetched) for instant render. */
  initialItems: TutorCardData[];
  initialTotal: number;
  /** Available subjects for the filter dropdown. */
  subjects: Array<{ id: string; name: string }>;
}

const PAGE_SIZE = 12;
const COLUMNS_AT_LG = 3;

const RATING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "0", label: "Toutes les notes" },
  { value: "3", label: "3+ ★" },
  { value: "4", label: "4+ ★" },
  { value: "4.5", label: "4.5+ ★" },
];

/**
 * Infinite-scroll tutor explorer.
 *
 * Filters: search + subject + minRating + verifiedOnly.
 * Each row in the virtualized grid holds 1 (mobile) → 2 → 3 tutor cards.
 */
export function TutorsExplorer({
  initialItems,
  initialTotal,
  subjects,
}: TutorsExplorerProps) {
  const t = useTranslations("Users");
  const [search, setSearch] = React.useState("");
  const [subject, setSubject] = React.useState<string>("all");
  const [minRating, setMinRating] = React.useState<string>("0");
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);

  // Debounced values used in the query key.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [debouncedSubject, setDebouncedSubject] = React.useState<string>("all");
  const [debouncedRating, setDebouncedRating] = React.useState<string>("0");
  const [debouncedVerified, setDebouncedVerified] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSubject(subject), 200);
    return () => clearTimeout(t);
  }, [subject]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedRating(minRating), 200);
    return () => clearTimeout(t);
  }, [minRating]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedVerified(verifiedOnly), 200);
    return () => clearTimeout(t);
  }, [verifiedOnly]);

  const isInitial =
    debouncedSearch === "" &&
    debouncedSubject === "all" &&
    debouncedRating === "0" &&
    !debouncedVerified;

  const queryKey = React.useMemo(
    () =>
      [
        "tutors-explorer",
        debouncedSearch,
        debouncedSubject === "all" ? undefined : debouncedSubject,
        Number(debouncedRating) || 0,
        debouncedVerified,
      ] as const,
    [debouncedSearch, debouncedSubject, debouncedRating, debouncedVerified],
  );

  const subjectParam =
    debouncedSubject === "all"
      ? undefined
      : subjects.find((s) => s.id === debouncedSubject)?.name;
  const ratingParam = Number(debouncedRating) || undefined;

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, error } =
    useInfiniteQuery({
      queryKey,
      queryFn: async ({ pageParam }) => {
        const res = await listTutorsAction({
          search: debouncedSearch || undefined,
          subject: subjectParam,
          minRating: ratingParam,
          verifiedOnly: debouncedVerified || undefined,
          page: pageParam,
          pageSize: PAGE_SIZE,
        });
        if (!res.success) {
          throw new Error(res.error.message);
        }
        return res.data;
      },
      initialPageParam: 1,
      initialData: isInitial
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
    estimateSize: () => 360,
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
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchTutors")}
            className="pl-9"
            aria-label={t("searchTutors")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-[200px]" aria-label={t("filterBySubject")}>
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

          <Select value={minRating} onValueChange={setMinRating}>
            <SelectTrigger className="w-[150px]" aria-label={t("minRating")}>
              <SelectValue placeholder={t("minRating")} />
            </SelectTrigger>
            <SelectContent>
              {RATING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-glass px-3 py-1.5">
            <Star className="size-3.5 text-accent-amber-400" />
            <Label htmlFor="verified-only" className="cursor-pointer text-xs font-medium">
              {t("verifiedOnly")}
            </Label>
            <Switch
              id="verified-only"
              checked={verifiedOnly}
              onCheckedChange={setVerifiedOnly}
            />
          </div>
        </div>
      </div>

      {/* List / Empty / Loading */}
      {error ? (
        <EmptyState
          icon={GraduationCap}
          title={t("noTutors")}
          description={String(error)}
        />
      ) : items.length === 0 && !isFetching ? (
        <EmptyState
          icon={GraduationCap}
          title={t("noTutors")}
          description={t("searchTutors")}
        />
      ) : (
        <div
          ref={parentRef}
          className="scrollbar-thin max-h-[calc(100vh-300px)] overflow-y-auto pr-1"
          role="list"
          aria-busy={isFetching}
        >
          {items.length === 0 && isFetching ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} variant="tutor" />
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
                    {rowItems.map((tutor) => (
                      <div key={tutor.id} role="listitem" className="h-full">
                        <TutorCard tutor={tutor} />
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
              <span>{t("searchTutors")}</span>
            </div>
          )}

          {hasNextPage && !isFetchingNextPage && items.length > 0 && (
            <div className="flex justify-center py-4">
              <Button
                type="button"
                variant="brand-outline"
                onClick={() => void fetchNextPage()}
              >
                {t("searchTutors")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
