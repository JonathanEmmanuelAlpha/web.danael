"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ChartContainerProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** When true, render the chart in a skeleton-loading state. */
  loading?: boolean;
  /** Optional height for the chart wrapper (CSS value). */
  height?: string;
}

/**
 * Aurora Navy wrapper for charts.
 *
 * Uses `glass-card` for the surface (backdrop-blur + transparency + soft
 * shadow), with a subtle primary-glow accent line on the top edge. Header
 * has a `font-display` title + muted description + optional action slot.
 *
 * Renders a shimmering skeleton placeholder while `loading` is true.
 */
export function ChartContainer({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  loading,
  height,
}: ChartContainerProps) {
  const hasHeader = Boolean(title || action);
  return (
    <div
      className={cn(
        "glass-card group relative overflow-hidden rounded-xl",
        // Soft primary hover glow on the whole card (subtle).
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_12px_40px_-8px_rgba(3,9,19,0.7)]",
        className,
      )}
    >
      {/* Top-edge primary gradient line */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/40 via-accent-cyan-400/20 to-transparent"
      />

      {hasHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h3 className="font-display text-base font-semibold text-foreground">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>
        {loading ? (
          <div
            className="relative overflow-hidden rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]"
            style={{ height: height ?? "240px" }}
            aria-hidden
          >
            <div className="absolute inset-0 animate-shimmer" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
