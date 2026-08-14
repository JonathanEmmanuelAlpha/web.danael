"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  FileEdit,
  Send,
  CalendarClock,
  Lock,
  Archive,
  Clock,
} from "lucide-react";
import type { AssignmentStatus } from "@/types";

interface AssignmentStatusBadgeProps {
  status: AssignmentStatus;
  className?: string;
  size?: "default" | "sm" | "lg";
}

const STATUS_CONFIG: Record<
  AssignmentStatus,
  { variant: "default" | "brand" | "secondary" | "warning" | "info" | "destructive"; iconKey: "draft" | "published" | "scheduled" | "closed" | "archived" }
> = {
  draft: { variant: "secondary", iconKey: "draft" },
  scheduled: { variant: "info", iconKey: "scheduled" },
  published: { variant: "brand", iconKey: "published" },
  closed: { variant: "warning", iconKey: "closed" },
  archived: { variant: "secondary", iconKey: "archived" },
};

const ICONS = {
  draft: FileEdit,
  published: Send,
  scheduled: CalendarClock,
  closed: Lock,
  archived: Archive,
} as const;

/**
 * Status badge for an assignment.
 * Variants: draft, scheduled, published, closed, archived.
 */
export function AssignmentStatusBadge({
  status,
  className,
  size = "sm",
}: AssignmentStatusBadgeProps) {
  const t = useTranslations("Assignments");
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = ICONS[config.iconKey];

  return (
    <Badge variant={config.variant} size={size} className={className}>
      <Icon className="size-3" aria-hidden />
      {t(status)}
    </Badge>
  );
}

/**
 * Status icon variant (without label, just the dot + tooltip).
 */
export function AssignmentStatusDot({
  status,
  className,
}: {
  status: AssignmentStatus;
  className?: string;
}) {
  const t = useTranslations("Assignments");
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = ICONS[config.iconKey] ?? Clock;

  const variantClasses: Record<string, string> = {
    default: "bg-secondary text-secondary-foreground",
    brand: "bg-primary-500/15 text-primary-700 dark:text-primary-400",
    secondary: "bg-muted text-muted-foreground",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/15 text-info",
    destructive: "bg-destructive/15 text-destructive",
  };

  return (
    <span
      title={t(status)}
      className={`inline-flex size-6 items-center justify-center rounded-md ${variantClasses[config.variant] ?? variantClasses.default} ${className ?? ""}`}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{t(status)}</span>
    </span>
  );
}
