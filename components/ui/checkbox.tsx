"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-border bg-input-bg shadow-sm transition-all duration-200",
        "hover:border-primary-500/50 hover:bg-input-bg-hover",
        "focus-visible:ring-[3px] focus-visible:ring-primary-500/20 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500 data-[state=checked]:text-secondary-900",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
