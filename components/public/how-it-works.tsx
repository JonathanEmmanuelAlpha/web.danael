"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserPlus, SlidersHorizontal, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  num: string;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
}

const STEPS: Step[] = [
  {
    num: "1",
    icon: UserPlus,
    titleKey: "steps.step1Title",
    descriptionKey: "steps.step1Description",
  },
  {
    num: "2",
    icon: SlidersHorizontal,
    titleKey: "steps.step2Title",
    descriptionKey: "steps.step2Description",
  },
  {
    num: "3",
    icon: Rocket,
    titleKey: "steps.step3Title",
    descriptionKey: "steps.step3Description",
  },
];

/**
 * 3-step "How it works" process (§5.1 — Comment ça marche).
 * Animated reveal on scroll with framer-motion.
 */
export function HowItWorks({ variant = "default" }: { variant?: "default" | "compact" }) {
  const t = useTranslations("Public.howItWorks");
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "relative grid gap-8 sm:grid-cols-3",
        isCompact && "lg:gap-6",
      )}
    >
      {/* Connecting line on desktop */}
      <div
        aria-hidden
        className="absolute left-1/2 top-12 hidden h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-primary-500/30 to-transparent sm:block"
      />

      {STEPS.map((step, i) => (
        <motion.div
          key={step.num}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4, delay: i * 0.12 }}
          className="relative flex flex-col items-center text-center"
        >
          <div className="relative">
            <div className="flex size-24 items-center justify-center rounded-3xl border border-primary-500/20 bg-card shadow-float">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-[0_10px_30px_-8px_rgba(147,217,26,0.5)]">
                <step.icon className="size-7" aria-hidden />
              </div>
            </div>
            <div
              className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-secondary-600 font-display text-sm font-bold text-white shadow-md"
              aria-hidden
            >
              {step.num}
            </div>
          </div>
          <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
            {t(step.titleKey as never)}
          </h3>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t(step.descriptionKey as never)}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
