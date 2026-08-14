"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Star, MessageSquare } from "lucide-react";
import { listTutorReviewsAction } from "@/server/actions/tutoring";
import type { ReviewWithReviewer } from "@/server/services/tutoring";

interface TutorReviewsListProps {
  tutorProfileId: string;
  pageSize?: number;
}

function initials(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim().charAt(0).toUpperCase();
  const l = (last ?? "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "?";
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * §5.15 — Paginated list of reviews for a tutor.
 */
export function TutorReviewsList({
  tutorProfileId,
  pageSize = 5,
}: TutorReviewsListProps) {
  const t = useTranslations("Tutoring");
  const [items, setItems] = useState<ReviewWithReviewer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    listTutorReviewsAction({
      tutorProfileId,
      page,
      pageSize,
    }).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setItems(res.data.items);
        setTotal(res.data.total);
      } else {
        setItems([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tutorProfileId, page, pageSize]);

  if (items === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={t("noReviews")}
        description={t("noReviewsHint")}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("reviewsCount", { count: total })}
      </p>
      <ul className="space-y-3">
        {items.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <Avatar className="size-9 border border-border">
                {r.reviewer.avatarUrl ? (
                  <AvatarImage src={r.reviewer.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="bg-primary-500/10 text-primary-700 dark:text-primary-400 text-xs font-semibold">
                  {initials(r.reviewer.firstName, r.reviewer.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {[r.reviewer.firstName, r.reviewer.lastName]
                      .filter(Boolean)
                      .join(" ") || t("anonymousReviewer")}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={
                        n <= r.rating
                          ? "size-3.5 fill-amber-400 text-amber-400"
                          : "size-3.5 text-muted-foreground"
                      }
                    />
                  ))}
                  <Badge variant="secondary" size="sm" className="ml-2">
                    {r.rating}/5
                  </Badge>
                </div>
                {r.comment && (
                  <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t("previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </div>
  );
}
