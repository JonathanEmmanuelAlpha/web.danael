"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Final CTA section (§5.1).
 * Big closing call to action with two buttons.
 */
export function FinalCta() {
  const t = useTranslations("Landing");

  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] p-10 sm:p-14"
        style={{
          background:
            "linear-gradient(135deg, var(--secondary-600) 0%, var(--secondary-800) 100%)",
        }}
      >
        {/* Decorative gradients */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 50% 60% at 90% 30%, rgba(147, 217, 26, 0.25) 0%, transparent 60%), radial-gradient(ellipse 40% 50% at 10% 80%, rgba(147, 217, 26, 0.15) 0%, transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="auth-dot-grid absolute inset-0 opacity-40"
        />

        <div className="relative z-10 flex flex-col items-center gap-8 text-center lg:flex-row lg:justify-between lg:text-left">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {t("finalCtaTitle")}
            </h2>
            <p className="mt-4 text-lg text-white/70">{t("finalCtaSubtitle")}</p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <Button asChild variant="brand" size="xl">
              <Link href="/sign-up">
                {t("finalCtaPrimary")}
                <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="xl"
              className="danael-btn-outline"
            >
              <Link href="/contact">
                <Calendar className="size-5" aria-hidden />
                {t("finalCtaSecondary")}
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
