import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5",
        brand:
          "bg-gradient-to-br from-primary-400 to-primary-600 text-secondary-900 font-semibold shadow-[0_8px_24px_-8px_rgba(147,217,26,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] hover:from-primary-300 hover:to-primary-500 hover:shadow-[0_12px_32px_-8px_rgba(147,217,26,0.7),inset_0_1px_0_rgba(255,255,255,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        "brand-outline":
          "border border-primary-500/30 bg-primary-500/5 text-primary-300 hover:bg-primary-500/10 hover:border-primary-500/50 hover:shadow-[0_0_20px_-4px_rgba(147,217,26,0.3)]",
        "brand-glass":
          "glass text-primary-300 border-primary-500/20 hover:border-primary-500/40 hover:bg-primary-500/10",
        destructive:
          "bg-gradient-to-br from-accent-coral-400 to-accent-coral-600 text-white shadow-[0_8px_24px_-8px_rgba(251,113,133,0.5)] hover:from-accent-coral-300 hover:to-accent-coral-500 hover:shadow-[0_12px_32px_-8px_rgba(251,113,133,0.7)] hover:-translate-y-0.5",
        outline:
          "border border-border bg-surface-glass backdrop-blur-md text-foreground shadow-sm hover:bg-surface-3 hover:border-border-strong hover:-translate-y-0.5",
        secondary:
          "bg-secondary-600 text-secondary-foreground shadow-sm hover:bg-secondary-500 hover:-translate-y-0.5",
        ghost:
          "hover:bg-accent hover:text-accent-foreground hover:shadow-sm",
        link: "text-primary-400 underline-offset-4 hover:underline hover:text-primary-300",
        glass:
          "glass text-foreground hover:bg-surface-glass-hover hover:border-border-strong",
        amber:
          "bg-gradient-to-br from-accent-amber-400 to-accent-amber-600 text-secondary-900 font-semibold shadow-[0_8px_24px_-8px_rgba(251,191,36,0.5)] hover:from-accent-amber-300 hover:to-accent-amber-500 hover:-translate-y-0.5",
        violet:
          "bg-gradient-to-br from-accent-violet-400 to-accent-violet-600 text-white font-semibold shadow-[0_8px_24px_-8px_rgba(167,139,250,0.5)] hover:from-accent-violet-300 hover:to-accent-violet-500 hover:-translate-y-0.5",
        cyan:
          "bg-gradient-to-br from-accent-cyan-400 to-accent-cyan-600 text-secondary-900 font-semibold shadow-[0_8px_24px_-8px_rgba(34,211,238,0.5)] hover:from-accent-cyan-300 hover:to-accent-cyan-500 hover:-translate-y-0.5",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-lg px-6 text-base has-[>svg]:px-4",
        xl: "h-12 rounded-xl px-8 text-base has-[>svg]:px-5",
        icon: "size-9 rounded-lg",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
