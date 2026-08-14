import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-3",
        "before:absolute before:inset-0 before:animate-shimmer before:bg-[linear-gradient(90deg,transparent_0%,rgba(147,217,26,0.1)_50%,transparent_100%)] before:bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
