"use client";

import { useSearchParams } from "next/navigation";
import { ContentList } from "./content-list";
import type { ListContentsQuery } from "@/server/validators/contents";

/**
 * Reads the URL search params and forwards them as filters to <ContentList />.
 *
 * This must be a client component because `useSearchParams()` is a client hook.
 */
export function LibraryContent() {
  const params = useSearchParams();
  const filters: Omit<ListContentsQuery, "page" | "pageSize"> = {
    search: params.get("search") ?? undefined,
    type: (params.get("type") ?? undefined) as ListContentsQuery["type"],
    level: (params.get("level") ?? undefined) as ListContentsQuery["level"],
    series: (params.get("series") ?? undefined) as ListContentsQuery["series"],
    subjectId: params.get("subjectId") ?? undefined,
    difficulty: (params.get("difficulty") ?? undefined) as ListContentsQuery["difficulty"],
    sort: (params.get("sort") ?? "recent") as ListContentsQuery["sort"],
  };
  return <ContentList filters={filters} />;
}
