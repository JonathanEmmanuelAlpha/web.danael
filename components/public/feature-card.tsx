import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: "primary" | "navy" | "amber" | "rose" | "emerald";
  className?: string;
  children?: ReactNode;
}

const ACCENTS: Record<
  NonNullable<FeatureCardProps["accent"]>,
  string
> = {
  primary: "bg-primary-500/10 text-primary-700 dark:text-primary-400",
  navy: "bg-secondary-600/10 text-secondary-600 dark:text-secondary-300",
  amber: "bg-warning/10 text-warning",
  rose: "bg-destructive/10 text-destructive",
  emerald: "bg-success/10 text-success",
};

/**
 * Feature card used on the landing features grid (§5.1).
 */
export function FeatureCard({
  icon: Icon,
  title,
  description,
  accent = "primary",
  className,
  children,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "group relative h-full gap-0 overflow-hidden p-6 transition-all hover:-translate-y-1 hover:shadow-float",
        className,
      )}
    >
      {/* Subtle gradient hover overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in oklch, var(--primary-500) 8%, transparent) 0%, transparent 60%)",
        }}
      />
      <div className="relative">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
            ACCENTS[accent],
          )}
        >
          <Icon className="size-6" aria-hidden />
        </div>
        <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {children}
      </div>
    </Card>
  );
}
