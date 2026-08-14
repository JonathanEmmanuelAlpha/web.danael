import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
  children?: ReactNode;
}

/**
 * Polished empty state (§6.1) — Aurora Navy refonte.
 *
 * - subtle dot-grid background
 * - large icon in a glass rounded-2xl badge with primary glow
 * - `font-display` title, muted description
 * - centered brand action button
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      {/* Subtle dot-grid background */}
      <div
        aria-hidden
        className="dot-grid pointer-events-none absolute inset-0 opacity-30"
      />
      {/* Soft radial wash behind the icon */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full bg-primary-500/10 blur-2xl"
      />

      <div className="relative flex flex-col items-center justify-center">
        {Icon && (
          <div className="glass mb-4 flex size-16 items-center justify-center rounded-2xl text-primary-400 glow-primary-sm">
            <Icon className="size-8" aria-hidden />
          </div>
        )}
        <h3 className="font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        {description && (
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {action &&
          (action.href ? (
            <Button asChild variant="brand" size="sm" className="mt-5">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button
              variant="brand"
              size="sm"
              className="mt-5"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        {children}
      </div>
    </div>
  );
}
