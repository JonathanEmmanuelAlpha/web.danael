import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Animated spinner with primary glow. Use inside buttons or as standalone loader. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-flex", className)}
      role="status"
      aria-live="polite"
    >
      {/* Glow halo behind the spinner */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full opacity-60 blur-[6px] bg-primary-500/30"
      />
      <Loader2
        className="relative size-4 animate-spin text-primary-400"
        aria-hidden
      />
      <span className="sr-only">Chargement…</span>
    </span>
  );
}

/** Full-page centered loader (route level) with primary glow + label. */
export function PageLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        {/* Outer glow */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-primary-500/20 blur-xl"
        />
        <div className="size-12 animate-spin rounded-full border-2 border-primary-500/20 border-t-primary-400 shadow-[0_0_24px_-4px_rgba(147,217,26,0.6)]" />
      </div>
      {label && (
        <p className="animate-pulse text-sm text-muted-foreground">{label}</p>
      )}
    </div>
  );
}

/** Skeleton placeholder with shimmer effect (animate-shimmer). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]",
        className,
      )}
      aria-hidden
    >
      {/* Shimmer sweep */}
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
}

/** Inline card skeleton for dashboard lists. */
export function CardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-8 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/2" />
    </div>
  );
}

/** Grid of skeletons. */
export function GridSkeleton({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
