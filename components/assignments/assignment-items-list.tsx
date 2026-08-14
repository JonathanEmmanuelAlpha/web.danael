"use client";

import { useTranslations } from "next-intl";
import { FileText, Link as LinkIcon, Type, File as FileIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { AssignmentItem } from "@/server/db/schema/assignments";

interface AssignmentItemsListProps {
  items: AssignmentItem[];
  className?: string;
}

/**
 * §5.5 — List of resources attached to an assignment (file/url/text/quiz).
 *
 * The `url` column holds the URL or the text content depending on the type.
 */
export function AssignmentItemsList({
  items,
  className,
}: AssignmentItemsListProps) {
  const t = useTranslations("Assignments");

  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t("noItems")}
        description={t("noItemsHint")}
        className={className}
      />
    );
  }

  return (
    <ul className={`space-y-2 ${className ?? ""}`}>
      {items.map((item, idx) => {
        const Icon =
          item.type === "url"
            ? LinkIcon
            : item.type === "text"
              ? Type
              : item.type === "quiz"
                ? FileText
                : FileIcon;
        const label =
          item.type === "url"
            ? (item.url ?? "")
            : item.type === "text"
              ? (item.url ?? "")
              : item.contentId ?? t("itemTypeContent");

        return (
          <li key={item.id}>
            <Card className="flex items-start gap-3 p-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-400">
                <Icon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.type === "url"
                      ? t("itemTypeUrl")
                      : item.type === "text"
                        ? t("itemTypeText")
                        : item.type === "quiz"
                          ? t("itemTypeQuiz")
                          : t("itemTypeContent")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    #{idx + 1}
                  </span>
                </div>
                {item.type === "url" && item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
                  >
                    {item.url}
                  </a>
                ) : item.type === "text" && item.url ? (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
                    {item.url}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t("itemTypeContent")} #{idx + 1}
                  </p>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
