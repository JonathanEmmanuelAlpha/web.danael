"use client";

import * as React from "react";
import { Verified } from "lucide-react";
import { IconImageGeneration } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { QuestionSourceValue } from "@/server/db/schema/enums";

interface QuestionSourceBadgeProps {
  source: QuestionSourceValue;
  size?: "sm" | "md";
  /** Render only an icon (no text) — useful in dense lists. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * §10.4 — Badge showing whether a question is verified (by a teacher) or
 * generated (by AI), used everywhere quiz questions are displayed.
 *
 * Aurora Navy design system:
 *  - Verified  → green border + soft green glow (lucide `Verified`)
 *  - Generated → cyan border + soft cyan glow   (`@tabler/icons-react` `IconImageGeneration`)
 *
 * The badge is intentionally compact (pill shape, ~xs font size) so it can be
 * dropped next to a question label, a difficulty badge, or a question-type
 * badge without breaking the layout.
 */
export function QuestionSourceBadge({
  source,
  size = "sm",
  iconOnly = false,
  className,
}: QuestionSourceBadgeProps) {
  const isVerified = source === "verified";

  const sizeClasses =
    size === "md"
      ? "px-2.5 py-1 text-xs"
      : "px-2 py-0.5 text-[11px]";

  const iconSize = size === "md" ? "size-3.5" : "size-3";

  const label = isVerified ? "Verified" : "Generated";

  const colorClasses = isVerified
    ? "border-green-500/30 bg-green-500/10 text-green-400 shadow-[0_0_8px_-2px_rgba(34,197,94,0.3)]"
    : "border-accent-cyan-500/30 bg-accent-cyan-500/10 text-accent-cyan-400 shadow-[0_0_8px_-2px_rgba(34,211,238,0.3)]";

  const Icon = isVerified ? Verified : IconImageGeneration;

  if (iconOnly) {
    return (
      <span
        title={label}
        aria-label={label}
        role="status"
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
          colorClasses,
          className,
        )}
      >
        <Icon className={iconSize} aria-hidden />
      </span>
    );
  }

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        sizeClasses,
        colorClasses,
        className,
      )}
    >
      <Icon className={iconSize} aria-hidden />
      {label}
    </span>
  );
}

export { Verified as VerifiedIcon, IconImageGeneration as GeneratedIcon };
