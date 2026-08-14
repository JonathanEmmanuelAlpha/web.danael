"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface StatTrendProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Percentage trend. 0 = neutral. */
  trend?: number;
  /** Optional label appended below the trend percentage. */
  trendLabel?: string;
  hint?: string;
  accent?: "primary" | "blue" | "amber" | "rose" | "emerald";
  className?: string;
}

/**
 * Aurora Navy accent → icon-badge bg/text color + hover glow + top-line gradient.
 *
 * The `accent` API is preserved (`primary|blue|amber|rose|emerald`) but
 * mapped to the Aurora Navy palette:
 *  - `blue`   → cyan accent
 *  - `rose`   → coral accent
 *  - `emerald`→ success green
 */
const ACCENT_BADGE: Record<NonNullable<StatTrendProps["accent"]>, string> = {
  primary:
    "bg-primary-500/10 text-primary-400 ring-1 ring-inset ring-primary-500/20",
  blue: "bg-accent-cyan-500/10 text-accent-cyan-400 ring-1 ring-inset ring-accent-cyan-500/20",
  amber:
    "bg-accent-amber-500/10 text-accent-amber-400 ring-1 ring-inset ring-accent-amber-500/20",
  rose: "bg-accent-coral-500/10 text-accent-coral-400 ring-1 ring-inset ring-accent-coral-500/20",
  emerald: "bg-success/10 text-success ring-1 ring-inset ring-success/20",
};

const ACCENT_HOVER_GLOW: Record<NonNullable<StatTrendProps["accent"]>, string> = {
  primary: "hover:shadow-[0_0_30px_-6px_rgba(147,217,26,0.45)]",
  blue: "hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.45)]",
  amber: "hover:shadow-[0_0_30px_-6px_rgba(251,191,36,0.45)]",
  rose: "hover:shadow-[0_0_30px_-6px_rgba(251,113,133,0.45)]",
  emerald: "hover:shadow-[0_0_30px_-6px_rgba(34,197,94,0.45)]",
};

const ACCENT_TOP_LINE: Record<NonNullable<StatTrendProps["accent"]>, string> = {
  primary: "from-primary-500/60",
  blue: "from-accent-cyan-500/60",
  amber: "from-accent-amber-500/60",
  rose: "from-accent-coral-500/60",
  emerald: "from-success/60",
};

/**
 * Stat card with trend indicator (up/down arrow + percentage) — Aurora Navy.
 *
 *  - `glass-card` surface with hover lift + accent glow.
 *  - Top-edge accent gradient line.
 *  - Icon badge in rounded-lg with accent color (scales on hover).
 *  - Value uses `font-display font-bold text-xl` (or `text-2xl` on `sm:`).
 *  - Trend up: `text-success` + `TrendingUp` icon.
 *  - Trend down: `text-accent-coral-400` + `TrendingDown` icon.
 */
export function StatTrend({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  hint,
  accent = "primary",
  className,
}: StatTrendProps) {
  const direction =
    trend == null ? "neutral" : trend > 0 ? "up" : trend < 0 ? "down" : "neutral";
  const TrendIcon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "group glass-card relative overflow-hidden rounded-xl p-4",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-1 hover:border-border-strong",
        ACCENT_HOVER_GLOW[accent],
        className,
      )}
    >
      {/* Top accent line */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent",
          ACCENT_TOP_LINE[accent],
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 font-display text-xl font-bold leading-none text-foreground sm:text-2xl",
              accent === "primary" && "text-gradient-brand",
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
            ACCENT_BADGE[accent],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
      </div>

      {trend != null && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold",
              direction === "up" && "text-success",
              direction === "down" && "text-accent-coral-400",
              direction === "neutral" && "text-muted-foreground",
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden />
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && (
            <span className="text-muted-foreground">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
