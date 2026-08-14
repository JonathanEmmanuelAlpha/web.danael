import { useTranslations } from "next-intl";
import {
  TrendingUp,
  Library,
  Brain,
  Trophy,
  MessagesSquare,
  GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type FeatureKey =
  | "tracking"
  | "library"
  | "quizzes"
  | "gamification"
  | "messaging"
  | "tutoring";

/** New Aurora Navy accent palette for feature cards. */
type FeatureAccent =
  | "primary"
  | "cyan"
  | "violet"
  | "amber"
  | "coral";

interface FeatureItem {
  key: FeatureKey;
  icon: LucideIcon;
  accent: FeatureAccent;
}

const FEATURES: FeatureItem[] = [
  { key: "tracking", icon: TrendingUp, accent: "primary" },
  { key: "library", icon: Library, accent: "cyan" },
  { key: "quizzes", icon: Brain, accent: "violet" },
  { key: "gamification", icon: Trophy, accent: "amber" },
  { key: "messaging", icon: MessagesSquare, accent: "coral" },
  { key: "tutoring", icon: GraduationCap, accent: "primary" },
];

/** Badge background + text color per accent. */
const ACCENT_BADGE: Record<FeatureAccent, string> = {
  primary: "bg-primary-500/10 text-primary-400 ring-1 ring-inset ring-primary-500/20",
  cyan: "bg-accent-cyan-500/10 text-accent-cyan-400 ring-1 ring-inset ring-accent-cyan-500/20",
  violet: "bg-accent-violet-500/10 text-accent-violet-400 ring-1 ring-inset ring-accent-violet-500/20",
  amber: "bg-accent-amber-500/10 text-accent-amber-400 ring-1 ring-inset ring-accent-amber-500/20",
  coral: "bg-accent-coral-500/10 text-accent-coral-400 ring-1 ring-inset ring-accent-coral-500/20",
};

/** Subtle hover glow per accent. */
const ACCENT_HOVER_GLOW: Record<FeatureAccent, string> = {
  primary: "hover:shadow-[0_0_30px_-6px_rgba(147,217,26,0.4)]",
  cyan: "hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.4)]",
  violet: "hover:shadow-[0_0_30px_-6px_rgba(167,139,250,0.4)]",
  amber: "hover:shadow-[0_0_30px_-6px_rgba(251,191,36,0.4)]",
  coral: "hover:shadow-[0_0_30px_-6px_rgba(251,113,133,0.4)]",
};

/** Top-edge gradient line per accent. */
const ACCENT_TOP_LINE: Record<FeatureAccent, string> = {
  primary: "from-primary-500/60",
  cyan: "from-accent-cyan-500/60",
  violet: "from-accent-violet-500/60",
  amber: "from-accent-amber-500/60",
  coral: "from-accent-coral-500/60",
};

/**
 * Grid of feature cards on the landing page (§5.1 — Fonctionnalités) —
 * Aurora Navy refonte.
 *
 * - 3 cols desktop / 2 tablet / 1 mobile
 * - glass-card surface, hover lift + accent glow
 * - icon badge in rounded-xl glass with per-card accent
 */
export function FeaturesGrid() {
  const t = useTranslations("Landing.features");

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(({ key, icon: Icon, accent }) => (
        <article
          key={key}
          className={cn(
            "group glass-card relative overflow-hidden rounded-xl p-6",
            "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "hover:-translate-y-1 hover:border-border-strong",
            ACCENT_HOVER_GLOW[accent],
          )}
        >
          {/* Top accent line */}
          <div
            aria-hidden
            className={cn(
              "absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent",
              ACCENT_TOP_LINE[accent],
            )}
          />

          {/* Subtle radial hover wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.04) 0%, transparent 60%)",
            }}
          />

          <div className="relative">
            <div
              className={cn(
                "glass flex size-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                ACCENT_BADGE[accent],
              )}
            >
              <Icon className="size-6" aria-hidden />
            </div>
            <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
              {t(`${key}.title` as const)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(`${key}.description` as const)}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
