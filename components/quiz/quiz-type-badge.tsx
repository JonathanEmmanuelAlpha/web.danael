"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Award, BookOpen, ClipboardList, FileCheck } from "lucide-react";
import type { QuizTypeValue } from "@/server/db/schema/enums";

const TYPE_ICON: Record<QuizTypeValue, typeof BookOpen> = {
  practice: BookOpen,
  exam: Award,
  homework: ClipboardList,
  diagnostic: FileCheck,
};

const TYPE_VARIANT: Record<
  QuizTypeValue,
  "brand" | "info" | "warning" | "success"
> = {
  practice: "brand",
  exam: "warning",
  homework: "info",
  diagnostic: "success",
};

/**
 * §5.6 — Badge showing the quiz type (practice / exam / homework / diagnostic).
 */
export function QuizTypeBadge({
  type,
  size,
}: {
  type: QuizTypeValue;
  size?: "default" | "sm" | "lg";
}) {
  const t = useTranslations("Quizzes");
  const Icon = TYPE_ICON[type];
  const variant = TYPE_VARIANT[type];
  return (
    <Badge variant={variant} size={size ?? "sm"}>
      <Icon className="size-3" aria-hidden />
      {t(`quizTypes.${type}` as const)}
    </Badge>
  );
}
