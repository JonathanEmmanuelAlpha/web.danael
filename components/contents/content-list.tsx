"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Library } from "lucide-react";
import { ContentCard } from "./content-card";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading";
import { listContentsAction } from "@/server/actions/contents";
import type { ContentListItem } from "@/server/services/contents";
import type { ListContentsQuery } from "@/server/validators/contents";

export interface ContentListProps {
  filters: Omit<ListContentsQuery, "page" | "pageSize">;
  /** Override empty-state copy. */
  emptyTitle?: string;
  emptyHint?: string;
}

/**
 * Client-side list of content cards, fetched via `listContentsAction`.
 * Used by the library page (with filters) and the teacher/school list pages
 * (filter by `uploadedBy`).
 */
export function ContentList({
  filters,
  emptyTitle,
  emptyHint,
}: ContentListProps) {
  const t = useTranslations("Contents");
  const [items, setItems] = useState<ContentListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    listContentsAction({
      ...filters,
      page: 1,
      pageSize: 60,
    }).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setItems(res.data.items);
        setTotal(res.data.total);
      } else {
        setItems([]);
        setTotal(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filtersKey]);

  if (items === null) {
    return <GridSkeleton count={6} columns={3} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title={emptyTitle ?? t("noResults")}
        description={emptyHint ?? t("noResultsHint")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t("resultsCount", { count: total })}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <li key={c.id}>
            <ContentCard content={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

