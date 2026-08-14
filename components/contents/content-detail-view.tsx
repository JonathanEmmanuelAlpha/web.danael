"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Download,
  Eye,
  Clock,
  Calendar,
  User as UserIcon,
  BookOpen,
  FileText,
  Loader2,
  PlayCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/shared/loading";
import { ContentTypeBadge } from "./content-type-badge";
import { FavoriteButton } from "./favorite-button";
import { ContentNotes } from "./content-notes";
import { ReportContentDialog } from "./report-content-dialog";
import { incrementDownloadsAction } from "@/server/actions/contents";
import type { ContentWithRelations } from "@/server/services/contents";
import type { ApiResponse } from "@/lib/api-response";

export interface ContentDetailViewProps {
  content: ContentWithRelations;
  canEdit?: boolean;
}

interface DownloadUrlResponse {
  downloadUrl: string;
  key: string;
}

/**
 * Full detail view of a content:
 * - Header (title, type, status, actions)
 * - Metadata grid (subject, level, series, difficulty, duration, year, uploader)
 * - PDF inline viewer iframe (via presigned download URL) — only for PDFs
 * - Favorite button
 * - Notes section
 * - Report dialog
 */
export function ContentDetailView({
  content,
  canEdit = false,
}: ContentDetailViewProps) {
  const t = useTranslations("Contents");
  const tCommon = useTranslations("Common");
  const tClasses = useTranslations("Classes");

  const isUploadthing =
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER === "uploadthing";

  const [downloadUrl, setDownloadUrl] = useState<string | null>(
    content.file?.fileUrl ?? null,
  );
  const [loadingUrl, setLoadingUrl] = useState(false);

  const isPdf = content.file?.contentType === "application/pdf";
  const isVideo = content.file?.contentType?.startsWith("video/") ?? false;

  // Fetch a presigned download URL on mount (for PDF inline viewing).
  useEffect(() => {
    if (!content.file?.key) return;
    let cancelled = false;
    setLoadingUrl((_) => {
      if (isUploadthing) return false;

      return true;
    });

    if (!isUploadthing) {
      fetch(
        `/api/files/download-url?key=${encodeURIComponent(content.file.key)}`,
      )
        .then((r) => r.json())
        .then((json: ApiResponse<DownloadUrlResponse>) => {
          if (cancelled) return;
          if (json.success) setDownloadUrl(json.data.downloadUrl);
        })
        .catch(() => {
          // Non-blocking — the download button will fetch on demand.
        })
        .finally(() => {
          if (!cancelled) setLoadingUrl(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [content.file?.key, isUploadthing]);

  console.log("downloadUrl", downloadUrl);
  console.log("content.file?.fileUrl", content.file?.fileUrl);

  async function handleDownload() {
    if (!content.file?.key || !downloadUrl) return;
    setLoadingUrl(true);
    try {
      // Increment downloads counter (fire and forget).
      void incrementDownloadsAction(content.id);
      // Trigger the download.
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = content.file.originalName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error(t("downloadError"));
    } finally {
      setLoadingUrl(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ContentTypeBadge type={content.type} />
            <Badge variant="outline" size="sm">
              {t(`status.${content.publicationStatus}` as const)}
            </Badge>
            <Badge variant="outline" size="sm">
              {t(`visibility.${content.visibility}` as const)}
            </Badge>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {content.title}
          </h1>
          {content.description && (
            <p className="text-sm text-muted-foreground sm:text-base">
              {content.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <FavoriteButton
            contentId={content.id}
            initialFavorited={false}
            size="default"
          />
          {content.file && (
            <Button
              variant="brand"
              onClick={handleDownload}
              disabled={loadingUrl}
            >
              {loadingUrl ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {tCommon("download")}
            </Button>
          )}
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/contents/${content.id}/edit`}>
                {tCommon("edit")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <Card className="p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {content.subject && (
            <MetaItem
              icon={BookOpen}
              label={t("subject")}
              value={content.subject.name}
            />
          )}
          {content.level && (
            <MetaItem
              icon={BookOpen}
              label={t("level")}
              value={tClasses(`levelLabels.${content.level}` as const)}
            />
          )}
          {content.series && (
            <MetaItem
              icon={BookOpen}
              label={t("series")}
              value={t("seriesLabel", { series: content.series })}
            />
          )}
          {content.difficulty && (
            <MetaItem
              icon={AlertTriangle}
              label={t("difficultyLabel")}
              value={t(`difficulty.${content.difficulty}` as const)}
            />
          )}
          {content.durationMinutes != null && (
            <MetaItem
              icon={Clock}
              label={t("duration")}
              value={`${content.durationMinutes} min`}
            />
          )}
          {content.year && (
            <MetaItem
              icon={Calendar}
              label={t("year")}
              value={String(content.year)}
            />
          )}
          {content.uploader && (
            <MetaItem
              icon={UserIcon}
              label={t("uploadedBy")}
              value={
                [content.uploader.firstName, content.uploader.lastName]
                  .filter(Boolean)
                  .join(" ") || content.uploader.email
              }
            />
          )}
          <MetaItem
            icon={Eye}
            label={t("views")}
            value={String(content.viewsCount)}
          />
          <MetaItem
            icon={Download}
            label={t("downloads")}
            value={String(content.downloadsCount)}
          />
        </dl>

        {content.tags && content.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">{t("tags")}:</span>
            {content.tags.map((tag) => (
              <Badge key={tag} variant="secondary" size="sm">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* File viewer */}
      {content.file ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium text-foreground">
                {content.file.originalName}
              </span>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {Math.round(content.file.size / 1024)} KB
            </span>
          </div>
          <div className="bg-muted/30">
            {loadingUrl ? (
              <div className="flex h-[480px] items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : isPdf && downloadUrl ? (
              <iframe
                src={downloadUrl}
                title={content.title}
                className="h-[600px] w-full border-0"
                aria-label={t("preview")}
              />
            ) : isVideo && downloadUrl ? (
              <video
                src={downloadUrl}
                controls
                className="h-[480px] w-full bg-black"
                aria-label={content.title}
              >
                {t("noPreview")}
              </video>
            ) : (
              <div className="flex h-[240px] flex-col items-center justify-center gap-3 text-center">
                <PlayCircle className="size-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("noPreview")}
                </p>
                <Button variant="brand" onClick={handleDownload}>
                  <Download className="size-4" />
                  {tCommon("download")}
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-5 text-center text-sm text-muted-foreground">
          {t("noFile")}
        </Card>
      )}

      {/* Notes + Report */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display text-base font-semibold text-foreground">
            {t("notes")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("notesHint")}</p>
          <div className="mt-4">
            <ContentNotes contentId={content.id} />
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-base font-semibold text-foreground">
            {t("report")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("reportDescription")}
          </p>
          <div className="mt-4">
            <ReportContentDialog contentId={content.id} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Helper component ──────────────────────────────────────── */

import type { LucideIcon } from "lucide-react";
import { file } from "zod";

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-400">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {value}
        </dd>
      </div>
    </div>
  );
}
