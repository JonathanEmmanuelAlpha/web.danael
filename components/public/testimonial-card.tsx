import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Star } from "lucide-react";

export interface TestimonialCardProps {
  name: string;
  role: string;
  school?: string;
  content: string;
  rating?: number;
  avatarInitials: string;
  accent?: "primary" | "navy" | "amber" | "rose" | "emerald";
  className?: string;
}

const ACCENTS: Record<
  NonNullable<TestimonialCardProps["accent"]>,
  string
> = {
  primary: "bg-primary-500/10 text-primary-700 dark:text-primary-400",
  navy: "bg-secondary-600/10 text-secondary-600 dark:text-secondary-300",
  amber: "bg-warning/10 text-warning",
  rose: "bg-destructive/10 text-destructive",
  emerald: "bg-success/10 text-success",
};

/**
 * Single testimonial card (§5.1 — Témoignages).
 */
export function TestimonialCard({
  name,
  role,
  school,
  content,
  rating = 5,
  avatarInitials,
  accent = "primary",
  className,
}: TestimonialCardProps) {
  const t = useTranslations("Landing");

  return (
    <article
      className={cn(
        "flex h-full flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-float",
        className,
      )}
    >
      <div className="flex items-center gap-2" aria-label={`${rating} sur 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i < rating
                ? "fill-warning text-warning"
                : "fill-muted text-muted-foreground",
            )}
            aria-hidden
          />
        ))}
      </div>
      <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
        &ldquo;{content}&rdquo;
      </blockquote>
      <footer className="flex items-center gap-3 border-t border-border pt-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
            ACCENTS[accent],
          )}
          aria-hidden
        >
          {avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {role}
            {school ? ` · ${school}` : ""}
          </p>
        </div>
      </footer>
    </article>
  );
}
