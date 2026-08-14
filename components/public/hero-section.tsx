"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Trophy,
  Target,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

/**
 * Hero section of the landing page (§5.1) — Aurora Navy refonte.
 *
 * Features:
 *  - aurora-bg background with animated halos (lime, blue, violet) + dot grid
 *  - huge headline (text-5xl / md:text-7xl) with aurora gradient
 *  - subheadline in muted foreground, max-w-2xl
 *  - CTA buttons: brand (lime gradient) + brand-outline
 *  - floating glass cards (animate-float) around a dashboard mockup
 *  - "Beta" badge with glow at the top
 */
export function HeroSection() {
  const t = useTranslations("Landing");

  return (
    <section
      className="aurora-bg relative overflow-hidden"
      aria-labelledby="hero-title"
    >
      {/* ── Decorative halos ── */}
      <div
        aria-hidden
        className="halo-lime left-[-10%] top-[-15%] h-[420px] w-[420px]"
      />
      <div
        aria-hidden
        className="halo-blue right-[-8%] top-[20%] h-[380px] w-[380px]"
      />
      <div
        aria-hidden
        className="halo-violet bottom-[-20%] left-[30%] h-[460px] w-[460px]"
      />

      {/* ── Dot grid overlay ── */}
      <div
        aria-hidden
        className="dot-grid pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: copy + CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center lg:text-left"
          >
            {/* Beta badge with glow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-3.5 py-1.5 text-xs font-semibold text-primary-300 glow-primary-sm">
              <Sparkles className="size-3.5 animate-pulse-glow" aria-hidden />
              {t("badge")}
            </div>

            <h1
              id="hero-title"
              className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-gradient-aurora sm:text-6xl lg:text-7xl"
            >
              {t("heroTitle")}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground lg:mx-0 lg:text-xl">
              {t("heroSubtitle")}
            </p>

            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button asChild variant="brand" size="xl" className="w-full sm:w-auto">
                <Link href="/sign-up">
                  {t("heroCta")}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                variant="brand-outline"
                size="xl"
                className="w-full sm:w-auto"
              >
                <Link href="/contact">{t("demoCta")}</Link>
              </Button>
            </div>

            {/* Logos row — subtle partner teaser */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground lg:justify-start">
              <span className="font-medium text-foreground/80">Danaël</span>
              <span aria-hidden>•</span>
              <span>Cameroun 🇨🇲</span>
              <span aria-hidden>•</span>
              <span>FR / EN</span>
            </div>
          </motion.div>

          {/* Right: floating achievement cards around a dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative mx-auto hidden h-[480px] w-full max-w-md lg:block"
            aria-hidden
          >
            {/* Central dashboard mockup */}
            <div className="absolute left-1/2 top-1/2 w-[88%] -translate-x-1/2 -translate-y-1/2">
              <div className="glass-card rounded-3xl p-6 glow-primary-sm">
                <div className="flex items-center justify-between">
                  <Logo variant="light" />
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 animate-pulse-glow rounded-full bg-primary-400" />
                    <span className="text-xs font-medium text-primary-400">Live</span>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06]">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Progression
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold text-gradient-brand">
                      87%
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-primary-500 to-primary-400" />
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06]">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Niveau
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold text-foreground">14</p>
                    <p className="mt-2 text-xs text-primary-400">+1 250 XP</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06]">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Activité (7j)
                  </p>
                  <div className="mt-2 flex items-end gap-1.5">
                    {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary-700 to-primary-400"
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating achievement cards */}
            <FloatingCard
              className="left-[-10%] top-[8%] animate-float-1"
              icon={<Target className="size-4" />}
              title={t("heroCard1Title")}
              value={t("heroCard1Value")}
            />
            <FloatingCard
              className="right-[-8%] top-[35%] animate-float-2"
              icon={<Flame className="size-4" />}
              title={t("heroCard2Title")}
              value={t("heroCard2Value")}
            />
            <FloatingCard
              className="left-[-5%] bottom-[8%] animate-float-3"
              icon={<Trophy className="size-4" />}
              title={t("heroCard3Title")}
              value={t("heroCard3Value")}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FloatingCard({
  className,
  icon,
  title,
  value,
}: {
  className: string;
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div
      className={`glass-card absolute w-44 rounded-2xl p-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex size-7 items-center justify-center rounded-lg bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-500/20"
          aria-hidden
        >
          {icon}
        </div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      </div>
      <p className="mt-2 font-display text-base font-bold text-foreground">{value}</p>
    </div>
  );
}
