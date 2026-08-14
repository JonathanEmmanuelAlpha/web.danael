"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { ContentCard } from "./content-card";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading";
import { listFavoritesAction } from "@/server/actions/contents";
import type { FavoriteWithContent } from "@/server/services/contents";

/**
 * Lists the current user's favorite contents.
 */
export function FavoritesList() {
  const t = useTranslations("Contents");
  const [items, setItems] = useState<FavoriteWithContent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFavoritesAction({ page: 1, pageSize: 100 }).then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data.items : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return <GridSkeleton count={3} columns={3} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title={t("noFavorites")}
        description={t("noFavoritesHint")}
        action={{ label: t("browseLibrary"), href: "/library" }}
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((f) => (
        <li key={f.favoriteId}>
          <ContentCard content={f.content} />
        </li>
      ))}
    </ul>
  );
}
