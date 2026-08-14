"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, HelpCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Category = "general" | "account" | "billing" | "schools" | "privacy";

interface FaqItem {
  q: string;
  a: string;
  category: Category;
}

/**
 * FAQ section with accordion (§5.1 — FAQ interactive).
 * Filters by category on the dedicated /faq page (full mode),
 * or shows a few items as a teaser on the landing page (compact mode).
 */
export function FaqSection({
  compact = false,
  defaultCategory = "general",
}: {
  compact?: boolean;
  defaultCategory?: Category;
}) {
  const t = useTranslations("Public.faq");
  const [activeCategory, setActiveCategory] = React.useState<Category>(
    compact ? "general" : defaultCategory,
  );

  const items: FaqItem[] = React.useMemo(() => {
    const all: FaqItem[] = [
      { q: "general_1_q", a: "general_1_a", category: "general" },
      { q: "general_2_q", a: "general_2_a", category: "general" },
      { q: "general_3_q", a: "general_3_a", category: "general" },
      { q: "account_1_q", a: "account_1_a", category: "account" },
      { q: "account_2_q", a: "account_2_a", category: "account" },
      { q: "billing_1_q", a: "billing_1_a", category: "billing" },
      { q: "billing_2_q", a: "billing_2_a", category: "billing" },
      { q: "schools_1_q", a: "schools_1_a", category: "schools" },
      { q: "schools_2_q", a: "schools_2_a", category: "schools" },
      { q: "privacy_1_q", a: "privacy_1_a", category: "privacy" },
      { q: "privacy_2_q", a: "privacy_2_a", category: "privacy" },
    ];
    if (compact) {
      return all.filter((x) => x.category === "general").slice(0, 4);
    }
    return all.filter((x) => x.category === activeCategory);
  }, [compact, activeCategory]);

  const categories: Category[] = compact
    ? ["general"]
    : ["general", "account", "billing", "schools", "privacy"];

  return (
    <div>
      {!compact && (
        <Tabs
          value={activeCategory}
          onValueChange={(v) => setActiveCategory(v as Category)}
          className="mb-8"
        >
          <TabsList className="mx-auto flex h-auto w-full max-w-2xl flex-wrap justify-center gap-1 rounded-2xl bg-muted p-1.5">
            {categories.map((c) => (
              <TabsTrigger
                key={c}
                value={c}
                className="flex-1 rounded-xl px-3 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {t(`categories.${c}` as const)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="mx-auto max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={compact ? "compact" : activeCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Accordion
              type="single"
              collapsible
              defaultValue={items[0]?.q}
              className="rounded-2xl border border-border bg-card p-2"
            >
              {items.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={item.q}
                  className="px-2 data-[state=open]:bg-primary-500/[0.03] data-[state=open]:rounded-xl data-[state=open]:my-1"
                >
                  <AccordionTrigger className="items-center gap-3 px-3 py-4 text-left text-base font-semibold hover:no-underline">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-400">
                      <HelpCircle className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1">{t(`items.${item.q}` as const)}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" aria-hidden />
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-4 pl-14 text-sm leading-relaxed text-muted-foreground">
                    {t(`items.${item.a}` as const)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </AnimatePresence>

        {compact && (
          <div className="mt-8 text-center">
            <Button asChild variant="brand-outline" size="lg">
              <Link href="/faq">Voir toute la FAQ</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
