import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
        "flex h-10 w-full min-w-0 rounded-lg border border-border bg-input-bg backdrop-blur-md px-3 py-2 text-base shadow-sm transition-all outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-border-strong hover:bg-input-bg-hover",
        "focus-visible:border-primary-500 focus-visible:bg-input-bg-focus focus-visible:ring-[3px] focus-visible:ring-primary-500/20 focus-visible:shadow-[0_0_20px_-4px_rgba(147,217,26,0.3)]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
