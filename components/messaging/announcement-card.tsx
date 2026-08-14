"use client";

import { useTranslations } from "next-intl";
import { Megaphone, School, Users, GraduationCap, Baby, Globe, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AnnouncementWithRelations } from "@/server/services/messaging";
import type { AudienceValue } from "@/server/db/schema/enums";

export interface AnnouncementCardProps {
  announcement: AnnouncementWithRelations;
  /** When true, shows the delete button (author or admin). */
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

const AUDIENCE_CONFIG: Record<
  AudienceValue,
  { icon: typeof Megaphone; labelKey: string; variant: "default" | "brand" | "info" | "warning" | "success" }
> = {
  school: { icon: School, labelKey: "audienceSchool", variant: "brand" },
  class: { icon: Users, labelKey: "audienceClass", variant: "info" },
  teachers: { icon: GraduationCap, labelKey: "audienceTeachers", variant: "warning" },
  students: { icon: GraduationCap, labelKey: "audienceStudents", variant: "default" },
  parents: { icon: Baby, labelKey: "audienceParents", variant: "success" },
  public: { icon: Globe, labelKey: "audiencePublic", variant: "default" },
};

function formatRelative(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60_000) return "à l'instant";
  if (diff < 60 * 60 * 1000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < day) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 2 * day) return "hier";
  if (diff < 7 * day) return `il y a ${Math.floor(diff / day)} j`;
  return d.toLocaleDateString();
}

/**
 * §5.11 — Announcement card display.
 *
 * Shows title, body (truncated), author, audience badge, publishedAt.
 */
export function AnnouncementCard({
  announcement,
  canDelete,
  onDelete,
  deleting,
}: AnnouncementCardProps) {
  const t = useTranslations("Messaging");
  const author = announcement.author;
  const authorName =
    [author?.firstName, author?.lastName].filter(Boolean).join(" ") ||
    author?.id.slice(0, 6) ||
    "—";
  const authorInitials =
    (author?.firstName?.[0] ?? "") + (author?.lastName?.[0] ?? "");
  const audienceCfg = AUDIENCE_CONFIG[announcement.audience];
  const AudienceIcon = audienceCfg.icon;

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary-500/30">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar className="size-9 border border-border">
            <AvatarFallback className="bg-primary-500/15 text-[11px] font-semibold text-primary-700 dark:text-primary-400">
              {authorInitials.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-base font-semibold text-foreground">
                {announcement.title}
              </h3>
              <Badge variant={audienceCfg.variant} size="sm">
                <AudienceIcon className="size-3" aria-hidden />
                {t(audienceCfg.labelKey)}
              </Badge>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{authorName}</span>
              {announcement.school && (
                <>
                  <span aria-hidden>•</span>
                  <span className="inline-flex items-center gap-1">
                    <School className="size-3" aria-hidden />
                    {announcement.school.name}
                  </span>
                </>
              )}
              {announcement.class && (
                <>
                  <span aria-hidden>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" aria-hidden />
                    {announcement.class.name}
                  </span>
                </>
              )}
              <span aria-hidden>•</span>
              <span>
                {announcement.publishedAt
                  ? formatRelative(announcement.publishedAt as unknown as Date)
                  : t("draft")}
              </span>
            </div>
          </div>
        </div>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label={t("delete")}
            disabled={deleting}
            onClick={() => onDelete?.(announcement.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
        {announcement.body}
      </p>
    </article>
  );
}
