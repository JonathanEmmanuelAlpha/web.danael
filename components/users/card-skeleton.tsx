import { cn } from "@/lib/utils";

/**
 * Generic glass-card skeleton used by the teachers / students / tutors
 * explorers as a loading placeholder. Mirrors the structure of a
 * TeacherCard / StudentCard / TutorCard so the layout doesn't shift
 * when results arrive.
 *
 * Usage:
 *   <CardSkeleton />
 *   <CardSkeleton variant="tutor" />
 *   <ul><CardSkeleton count={6} /></ul>
 */
export function CardSkeleton({
  variant = "default",
  className,
}: {
  variant?: "default" | "tutor" | "student";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-card animate-pulse rounded-2xl p-5",
        variant === "tutor" && "min-h-[260px]",
        variant === "student" && "min-h-[260px]",
        variant === "default" && "min-h-[220px]",
        className,
      )}
      aria-hidden
    >
      {/* Header row: avatar + name + email */}
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-full bg-white/[0.05]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
          <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
        </div>
        <div className="h-6 w-16 rounded-full bg-white/[0.05]" />
      </div>

      {/* Subject badges */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <div className="h-5 w-20 rounded-full bg-white/[0.05]" />
        <div className="h-5 w-24 rounded-full bg-white/[0.05]" />
        <div className="h-5 w-16 rounded-full bg-white/[0.05]" />
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-14 rounded-lg bg-white/[0.04]" />
        <div className="h-14 rounded-lg bg-white/[0.04]" />
        <div className="h-14 rounded-lg bg-white/[0.04]" />
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <div className="h-9 flex-1 rounded-lg bg-white/[0.06]" />
        <div className="h-9 flex-1 rounded-lg bg-white/[0.04]" />
      </div>
    </div>
  );
}

/**
 * Render N skeleton cards in a responsive grid (used by explorers while
 * loading the first page).
 */
export function CardSkeletonGrid({
  count = 6,
  variant = "default",
  className,
}: {
  count?: number;
  variant?: "default" | "tutor" | "student";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}
