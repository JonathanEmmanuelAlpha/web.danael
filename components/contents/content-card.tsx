"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, Download, Clock, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContentTypeBadge } from "./content-type-badge";
import type { ContentListItem } from "@/server/services/contents";
import Image from "next/image";

export interface ContentCardProps {
  content: ContentListItem;
  href?: string;
  className?: string;
}

/**
 * Card for the content catalog grid: thumbnail placeholder, title,
 * type badge, level/series, subject, view + download counts.
 */
export function ContentCard({ content, href, className }: ContentCardProps) {
  const t = useTranslations("Contents");
  const tClasses = useTranslations("Classes");

  const detailHref = href ?? `/contents/${content.id}`;

  return (
    <Card
      className={`group flex h-full flex-col gap-3 overflow-hidden p-0 transition hover:border-primary-500/40 hover:shadow-sm ${className ?? ""}`}
    >
      {/* Thumbnail placeholder (gradient by type) */}
      <Link href={detailHref} className="block relative">
        {content.thumbnail && (
          <Image
            alt={`${content.title}-Thumbnail`}
            src={content.thumbnail.fileUrl}
            fill
          />
        )}
        <div className="relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary-500/15 via-primary-500/5 to-transparent">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-background/80 text-primary-700 backdrop-blur dark:text-primary-400">
            <BookOpen className="size-6" />
          </div>
          <div className="absolute left-3 top-3">
            <ContentTypeBadge type={content.type} />
          </div>
          {content.publicationStatus !== "published" && (
            <div className="absolute right-3 top-3">
              <Badge variant="warning" size="sm">
                {t(`status.${content.publicationStatus}` as const)}
              </Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        <Link href={detailHref} className="min-w-0">
          <h3 className="line-clamp-2 font-display text-sm font-semibold text-foreground hover:text-primary-700 dark:hover:text-primary-400">
            {content.title}
          </h3>
        </Link>

        {content.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {content.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          {content.subject && (
            <Badge variant="secondary" size="sm">
              {content.subject.name}
            </Badge>
          )}
          {content.level && (
            <Badge variant="outline" size="sm">
              {tClasses(`levelLabels.${content.level}` as const)}
            </Badge>
          )}
          {content.series && (
            <Badge variant="outline" size="sm">
              {t("seriesLabel", { series: content.series })}
            </Badge>
          )}
          {content.difficulty && (
            <Badge variant="outline" size="sm">
              {t(`difficulty.${content.difficulty}` as const)}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden />
              {content.viewsCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Download className="size-3.5" aria-hidden />
              {content.downloadsCount}
            </span>
            {content.durationMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {content.durationMinutes}min
              </span>
            ) : null}
          </div>
          {content.year && <span className="text-xs">{content.year}</span>}
        </div>
      </div>
    </Card>
  );
}
