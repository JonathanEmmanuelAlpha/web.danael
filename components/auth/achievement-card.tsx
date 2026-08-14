import { BookOpen, Flame, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/* ────────────────────────────────────────────────────────────
   Floating achievement cards (social proof on auth pages).
   Data extracted from original AuthLayout.tsx (DRY).
   ──────────────────────────────────────────────────────────── */

export interface AchievementCardData {
  id: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  title: string;
  value: string;
  subtext: string;
  animation: string;
  position: string;
  delay: number;
}

export const achievementCards: AchievementCardData[] = [
  {
    id: "streak",
    Icon: Flame,
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-400",
    borderColor: "border-orange-400/20",
    title: "Série active",
    value: "7 jours 🔥",
    subtext: "W T F S S M T",
    animation: "animate-float-1",
    position: "top-[10%] right-[4%]",
    delay: 0.7,
  },
  {
    id: "goal",
    Icon: BookOpen,
    iconBg: "bg-primary-500/15",
    iconColor: "text-primary-400",
    borderColor: "border-primary-500/25",
    title: "Objectif du jour",
    value: "3/3 leçons ✓",
    subtext: "Complété !",
    animation: "animate-float-2",
    position: "top-[38%] right-[2%]",
    delay: 1.0,
  },
  {
    id: "quiz",
    Icon: Trophy,
    iconBg: "bg-yellow-400/15",
    iconColor: "text-yellow-400",
    borderColor: "border-yellow-400/20",
    title: "Quiz complété",
    value: "Score : 98%",
    subtext: "Excellent 🏆",
    animation: "animate-float-3",
    position: "bottom-[26%] right-[5%]",
    delay: 1.3,
  },
  {
    id: "community",
    Icon: Star,
    iconBg: "bg-blue-400/15",
    iconColor: "text-blue-400",
    borderColor: "border-blue-400/20",
    title: "Communauté",
    value: "10 000+ élèves",
    subtext: "Note : 4.8/5 ⭐",
    animation: "animate-float-1",
    position: "bottom-[8%] right-[6%]",
    delay: 1.6,
  },
];

/**
 * A single floating achievement card (glassmorphism).
 * Extracted from original AuthLayout.tsx (DRY).
 */
export function AchievementCard({ card }: { card: AchievementCardData }) {
  return (
    <div
      className={cn("absolute z-30", card.position, card.animation)}
      style={{ animationDelay: `${card.delay}s` }}
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border pl-3 pr-5 py-3 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(10,27,67,0.5)]",
          card.borderColor,
        )}
      >
        <div className={cn("rounded-xl p-2 shrink-0", card.iconBg)}>
          <card.Icon className="size-4.5" />
        </div>
        <div>
          <p className="text-white/45 text-[11px] leading-none mb-1">
            {card.title}
          </p>
          <p className="text-white font-semibold text-sm leading-none">
            {card.value}
          </p>
          <p className="text-white/35 text-[10px] mt-1 leading-none">
            {card.subtext}
          </p>
        </div>
      </div>
    </div>
  );
}
