import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  /** Show a subtle gradient divider line under the header. Default: true. */
  withDivider?: boolean;
  className?: string;
}

/**
 * Page header used across dashboard pages (§6.3).
 *
 * Aurora Navy design:
 *  - icon lives in a glass container with primary glow
 *  - title uses font-display, large
 *  - optional gradient divider line at the bottom
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  breadcrumbs,
  withDivider = true,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("relative flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="glass relative flex size-12 shrink-0 items-center justify-center rounded-xl text-primary-400 glow-primary-sm">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {breadcrumbs && <div className="mb-2">{breadcrumbs}</div>}
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {withDivider && (
        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-border-strong to-transparent"
        />
      )}
    </div>
  );
}
