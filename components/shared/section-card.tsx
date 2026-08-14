import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Section card with optional header (title + icon + action) — Aurora Navy.
 *
 * Uses `glass-card` surface. Header has icon in a glass badge with primary
 * glow, a `font-display` title, muted description, and an optional action
 * slot on the right. Children live in a padded content area.
 */
export function SectionCard({
  title,
  description,
  icon,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  const hasHeader = Boolean(title || action || icon);
  return (
    <div className={cn("glass-card overflow-hidden rounded-xl", className)}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="glass flex size-9 shrink-0 items-center justify-center rounded-lg text-primary-400 glow-primary-sm">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="font-display text-base font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </div>
  );
}
