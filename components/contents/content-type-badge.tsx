"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  CheckSquare,
  BookOpen,
  StickyNote,
  Video,
  PencilLine,
  GraduationCap,
  FileCheck,
  type LucideIcon,
} from "lucide-react";
import type { ContentTypeValue } from "@/server/db/schema/enums";

/* -- Per-type visual config (color + icon + i18n key) ------- */

interface TypeConfig {
  labelKey: string;
  variant: "brand" | "info" | "success" | "warning" | "secondary";
  icon: LucideIcon;
}

const TYPE_CONFIG: Record<ContentTypeValue, TypeConfig> = {
  epreuve: { labelKey: "types.epreuve", variant: "info", icon: FileText },
  corrige: { labelKey: "types.corrige", variant: "success", icon: CheckSquare },
  resume: { labelKey: "types.resume", variant: "brand", icon: BookOpen },
  fiche: { labelKey: "types.fiche", variant: "warning", icon: StickyNote },
  video: { labelKey: "types.video", variant: "info", icon: Video },
  exercice: {
    labelKey: "types.exercice",
    variant: "secondary",
    icon: PencilLine,
  },
  devoir_modele: {
    labelKey: "types.devoir_modele",
    variant: "brand",
    icon: GraduationCap,
  },
  sujet_blanc: {
    labelKey: "types.sujet_blanc",
    variant: "info",
    icon: FileCheck,
  },
};

/* -- Component ----------------------------------------------- */

export interface ContentTypeBadgeProps {
  type: ContentTypeValue;
  withIcon?: boolean;
  className?: string;
}

/**
 * Badge with a distinct color + icon per content type.
 */
export function ContentTypeBadge({
  type,
  withIcon = true,
  className,
}: ContentTypeBadgeProps) {
  const t = useTranslations("Contents");
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} size="sm" className={className}>
      {withIcon && <Icon className="size-3" aria-hidden />}
      {t(cfg.labelKey)}
    </Badge>
  );
}

/* -- Export the config for use elsewhere -------------------- */

export const CONTENT_TYPE_CONFIG = TYPE_CONFIG;
