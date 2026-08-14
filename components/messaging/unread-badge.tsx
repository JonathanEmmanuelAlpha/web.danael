"use client";

import { cn } from "@/lib/utils";

export interface UnreadBadgeProps {
  count: number;
  /** Hide when count is 0 (default true). */
  hideWhenZero?: boolean;
  className?: string;
}

/**
 * §5.11 — Small numeric badge for unread counts.
 * Used in the thread list, topbar bell, and sidebar.
 */
export function UnreadBadge({
  count,
  hideWhenZero = true,
  className,
}: UnreadBadgeProps) {
  if (count <= 0 && hideWhenZero) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={`${count} unread`}
      className={cn(
        "inline-flex min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ring-2 ring-background",
        className,
      )}
    >
      {display}
    </span>
  );
}
