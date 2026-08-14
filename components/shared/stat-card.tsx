import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  /**
   * Accent color for the icon badge + hover glow.
   * Preserved values: `primary | blue | amber | rose | emerald`.
   * - `blue`   → mapped to cyan accent (glow-cyan)
   * - `rose`   → mapped to coral accent (glow-coral)
   * - `emerald`→ kept green (success)
   */
  accent?: "primary" | "blue" | "amber" | "rose" | "emerald";
  className?: string;
  children?: ReactNode;
}

type AccentKey = NonNullable<StatCardProps["accent"]>;

/** Background + text color for the icon badge, per accent. */
const ACCENT_BADGE: Record<AccentKey, string> = {
  primary: "bg-primary-500/10 text-primary-400 ring-1 ring-inset ring-primary-500/20",
  blue: "bg-accent-cyan-500/10 text-accent-cyan-400 ring-1 ring-inset ring-accent-cyan-500/20",
  amber: "bg-accent-amber-500/10 text-accent-amber-400 ring-1 ring-inset ring-accent-amber-500/20",
  rose: "bg-accent-coral-500/10 text-accent-coral-400 ring-1 ring-inset ring-accent-coral-500/20",
  emerald: "bg-success/10 text-success ring-1 ring-inset ring-success/20",
};

/** Hover glow box-shadow per accent. */
const ACCENT_HOVER_GLOW: Record<AccentKey, string> = {
  primary: "hover:shadow-[0_0_30px_-6px_rgba(147,217,26,0.45)]",
  blue: "hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.45)]",
  amber: "hover:shadow-[0_0_30px_-6px_rgba(251,191,36,0.45)]",
  rose: "hover:shadow-[0_0_30px_-6px_rgba(251,113,133,0.45)]",
  emerald: "hover:shadow-[0_0_30px_-6px_rgba(34,197,94,0.45)]",
};

/** Decorative top-edge gradient per accent (subtle color wash). */
const ACCENT_TOP_LINE: Record<AccentKey, string> = {
  primary: "from-primary-500/60",
  blue: "from-accent-cyan-500/60",
  amber: "from-accent-amber-500/60",
  rose: "from-accent-coral-500/60",
  emerald: "from-success/60",
};

/**
 * KPI / stat card for dashboards (§5.9) — Aurora Navy refonte.
 *
 * - `glass-card` surface with hover lift + accent glow
 * - icon badge top-left in rounded-lg with accent color
 * - large `font-display` value (gradient when accent=primary)
 * - optional trend indicator with up/down arrow icon
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  accent = "primary",
  className,
  children,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group glass-card relative overflow-hidden rounded-xl p-5",
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
              "mt-2 font-display text-3xl font-bold leading-none",
              accent === "primary"
                ? "text-gradient-brand"
                : "text-foreground",
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
          )}
          {trend && (
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
                trend.direction === "up"
                  ? "text-success"
                  : "text-destructive",
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="size-3.5" aria-hidden />
              ) : (
                <TrendingDown className="size-3.5" aria-hidden />
              )}
              {Math.abs(trend.value)}%
            </p>
          )}
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
      {children}
    </div>
  );
}
