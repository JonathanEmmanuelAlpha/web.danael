import { cn } from "@/lib/utils";

type GlowColor = "primary" | "amber" | "violet" | "coral" | "cyan" | "lime" | "blue";

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Colored glow halo (always-on). */
  glow?: GlowColor | false;
  /** Enable hover lift + glow effect. */
  hover?: boolean;
};

/** Map a glow color to its design-system class. */
const GLOW_CLASS: Record<GlowColor, string> = {
  primary: "glow-primary",
  lime: "glow-primary", // alias — lime is the primary brand color
  blue: "glow-cyan", // alias — navy "blue" maps to cyan accent glow
  cyan: "glow-cyan",
  amber: "glow-amber",
  violet: "glow-violet",
  coral: "glow-coral",
};

/** Hover glow class per color (subtler than the always-on glow). */
const HOVER_GLOW_CLASS: Record<GlowColor, string> = {
  primary: "hover:glow-primary-sm",
  lime: "hover:glow-primary-sm",
  blue: "hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.45)]",
  cyan: "hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.45)]",
  amber: "hover:shadow-[0_0_24px_-6px_rgba(251,191,36,0.45)]",
  violet: "hover:shadow-[0_0_24px_-6px_rgba(167,139,250,0.45)]",
  coral: "hover:shadow-[0_0_24px_-6px_rgba(251,113,133,0.45)]",
};

/**
 * Carte verre générique de l'ADN Danaël — "Aurora Navy".
 *
 * S'appuie sur la classe `.glass-card` du design system (backdrop-blur +
 * transparence + ombre douce). Ajoute optionnellement un halo coloré
 * (`glow`) et/ou un effet d'élévation au survol (`hover`).
 */
export function GlassCard({
  className,
  glow = false,
  hover = false,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        glow && GLOW_CLASS[glow],
        hover &&
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-border-strong",
        hover && glow && HOVER_GLOW_CLASS[glow],
        className,
      )}
      {...props}
    />
  );
}
