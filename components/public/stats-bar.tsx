"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { GraduationCap, Building2, BookOpen, Smile } from "lucide-react";

interface StatItem {
  valueKey: string;
  labelKey: string;
  icon: LucideIcon;
  accent: string;
}

const STATS: StatItem[] = [
  {
    valueKey: "studentsValue",
    labelKey: "students",
    icon: GraduationCap,
    accent: "text-primary-700 dark:text-primary-400",
  },
  {
    valueKey: "schoolsValue",
    labelKey: "schools",
    icon: Building2,
    accent: "text-secondary-600 dark:text-secondary-300",
  },
  {
    valueKey: "resourcesValue",
    labelKey: "resources",
    icon: BookOpen,
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  {
    valueKey: "satisfactionValue",
    labelKey: "satisfaction",
    icon: Smile,
    accent: "text-warning",
  },
];

interface StatsBarProps {
  variant?: "default" | "inverted";
  className?: string;
}

/**
 * Horizontal bar with 4 key stats (§5.1 — preuve sociale).
 * Animated reveal with framer-motion.
 */
export function StatsBar({ variant = "default", className }: StatsBarProps) {
  const t = useTranslations("Landing.stats");
  const isInverted = variant === "inverted";

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 lg:grid-cols-4",
        className,
      )}
    >
      {STATS.map((stat, i) => (
        <motion.div
          key={stat.valueKey}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl p-5 text-center",
            isInverted
              ? "bg-white/[0.04] border border-white/10 backdrop-blur-sm"
              : "border border-border bg-card",
          )}
        >
          <div
            className={cn(
              "flex size-11 items-center justify-center rounded-xl",
              isInverted
                ? "bg-primary-500/10 text-primary-400"
                : "bg-primary-500/10 " + stat.accent,
            )}
            aria-hidden
          >
            <stat.icon className="size-5" />
          </div>
          <p
            className={cn(
              "font-display text-3xl font-bold tracking-tight sm:text-4xl",
              isInverted ? "text-white" : "text-foreground",
            )}
          >
            {t(stat.valueKey as never)}
          </p>
          <p
            className={cn(
              "text-xs font-medium sm:text-sm",
              isInverted ? "text-white/60" : "text-muted-foreground",
            )}
          >
            {t(stat.labelKey as never)}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
