"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Users,
  School,
  Building2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { LucideIcon } from "lucide-react";

type RoleKey = "student" | "parent" | "teacher" | "school";

interface RoleDef {
  key: RoleKey;
  icon: LucideIcon;
  accent: string;
  illustration: string;
}

const ROLES: RoleDef[] = [
  {
    key: "student",
    icon: GraduationCap,
    accent: "from-primary-500 to-primary-600",
    illustration: "🎓",
  },
  {
    key: "parent",
    icon: Users,
    accent: "from-secondary-500 to-secondary-700",
    illustration: "👨‍👩‍👧",
  },
  {
    key: "teacher",
    icon: School,
    accent: "from-emerald-500 to-emerald-700",
    illustration: "👩‍🏫",
  },
  {
    key: "school",
    icon: Building2,
    accent: "from-amber-500 to-amber-700",
    illustration: "🏫",
  },
];

/**
 * Benefits by role section (§5.1 — sections bénéfices par rôle).
 * Uses Tabs to switch between student / parent / teacher / school.
 */
export function RoleBenefits() {
  const t = useTranslations("Landing.benefits");

  return (
    <Tabs defaultValue="student" className="w-full">
      <TabsList className="mx-auto flex h-auto w-full max-w-2xl flex-wrap justify-center gap-1 rounded-2xl bg-muted p-1.5">
        {ROLES.map(({ key, icon: Icon }) => (
          <TabsTrigger
            key={key}
            value={key}
            className="flex-1 rounded-xl px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t(`${key}.label` as const)}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="mt-10">
        {ROLES.map(({ key, accent, illustration }) => (
          <TabsContent key={key} value={key} className="mt-0">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              {/* Illustration */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className={cn(
                  "relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br p-8 text-9xl",
                  accent,
                )}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
                    backgroundSize: "32px 32px",
                  }}
                />
                <span className="relative drop-shadow-2xl" aria-hidden>
                  {illustration}
                </span>
              </motion.div>

              {/* Copy */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.3 }}
                >
                  <h3 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                    {t(`${key}.title` as const)}
                  </h3>
                  <ul className="mt-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div
                          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-700 dark:text-primary-400"
                          aria-hidden
                        >
                          <Check className="size-3.5" />
                        </div>
                        <p className="text-sm leading-relaxed text-foreground sm:text-base">
                          {t(`${key}.points.${i}` as const)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
