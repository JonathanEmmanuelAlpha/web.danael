import { cn } from "@/lib/utils";

interface SchoolCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton placeholder matching the layout of `<SchoolCard>` for use during
 * the initial server-side fetch and while loading the next page.
 *
 * Uses `animate-pulse` and `bg-surface-3` blocks — no text content.
 */
export function SchoolCardSkeleton({ className }: SchoolCardSkeletonProps) {
  return (
    <div
      className={cn(
        "glass-card relative flex h-full flex-col gap-5 rounded-2xl p-6",
        className,
      )}
      aria-hidden
    >
      {/* Top: logo + name */}
      <div className="flex items-start gap-4">
        <div className="size-14 shrink-0 animate-pulse rounded-2xl bg-surface-3" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 animate-pulse rounded-md bg-surface-3" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface-3" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface-2/60 p-3"
          >
            <div className="size-7 animate-pulse rounded-lg bg-surface-3" />
            <div className="h-5 w-12 animate-pulse rounded bg-surface-3" />
            <div className="h-2.5 w-10 animate-pulse rounded bg-surface-3" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <div className="h-8 min-w-[140px] flex-1 animate-pulse rounded-md bg-surface-3" />
        <div className="h-8 min-w-[140px] flex-1 animate-pulse rounded-md bg-surface-3" />
        <div className="h-8 min-w-[140px] flex-1 animate-pulse rounded-md bg-surface-3" />
        <div className="h-8 min-w-[140px] flex-1 animate-pulse rounded-md bg-surface-3" />
      </div>
    </div>
  );
}
