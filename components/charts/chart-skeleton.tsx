"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn("h-[240px] w-full rounded-md", className)}
      aria-hidden
    />
  );
}

export function ChartGridSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <ChartSkeleton key={i} />
      ))}
    </div>
  );
}
