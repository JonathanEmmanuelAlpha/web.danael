"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Circle,
  UploadCloud,
  Clock,
  CheckCircle2,
  Undo2,
} from "lucide-react";
import type { SubmissionStatus } from "@/types";

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
  size?: "default" | "sm" | "lg";
}

const STATUS_CONFIG: Record<
  SubmissionStatus,
  {
    variant: "default" | "brand" | "secondary" | "warning" | "info" | "destructive" | "success";
    iconKey: "notStarted" | "submitted" | "late" | "graded" | "returned";
  }
> = {
  not_started: { variant: "secondary", iconKey: "notStarted" },
  submitted: { variant: "info", iconKey: "submitted" },
  late: { variant: "warning", iconKey: "late" },
  graded: { variant: "success", iconKey: "graded" },
  returned: { variant: "brand", iconKey: "returned" },
};

const ICONS = {
  notStarted: Circle,
  submitted: UploadCloud,
  late: Clock,
  graded: CheckCircle2,
  returned: Undo2,
} as const;

/**
 * Status badge for a student's submission.
 * Variants: not_started, submitted, late, graded, returned.
 */
export function SubmissionStatusBadge({
  status,
  className,
  size = "sm",
}: SubmissionStatusBadgeProps) {
  const t = useTranslations("Assignments");
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  const Icon = ICONS[config.iconKey];

  return (
    <Badge variant={config.variant} size={size} className={className}>
      <Icon className="size-3" aria-hidden />
      {t(status === "not_started" ? "notStarted" : status)}
    </Badge>
  );
}
