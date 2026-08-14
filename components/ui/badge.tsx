import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-primary-500/30 bg-primary-500/10 text-primary-300",
        secondary:
          "border-border-strong bg-surface-3 text-secondary-foreground",
        destructive:
          "border-accent-coral-500/30 bg-accent-coral-500/10 text-accent-coral-300",
        outline:
          "border-border bg-surface-glass text-foreground",
        success:
          "border-green-500/30 bg-green-500/10 text-green-400",
        warning:
          "border-accent-amber-500/30 bg-accent-amber-500/10 text-accent-amber-400",
        info:
          "border-accent-cyan-500/30 bg-accent-cyan-500/10 text-accent-cyan-400",
        violet:
          "border-accent-violet-500/30 bg-accent-violet-500/10 text-accent-violet-400",
        gradient:
          "border-transparent bg-gradient-to-r from-primary-500/20 via-accent-cyan-500/20 to-accent-violet-500/20 text-primary-300",
        brand:
          "border-primary-500/40 bg-primary-500/15 text-primary-300 shadow-[0_0_12px_-4px_rgba(147,217,26,0.4)]",
      },
      size: {
        default: "text-xs px-2 py-0.5",
        sm: "text-[11px] px-1.5 py-0.5 [&>svg]:size-2.5",
        lg: "text-sm px-2.5 py-1 [&>svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
