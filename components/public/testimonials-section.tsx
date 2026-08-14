"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { TestimonialCard } from "./testimonial-card";

interface TestimonialItem {
  id: number;
  name: string;
  role: string;
  school: string;
  contentKey: string;
  rating: number;
  initials: string;
  category: "student" | "parent" | "teacher" | "school";
  accent: "primary" | "navy" | "amber" | "rose" | "emerald";
}

const ITEMS: TestimonialItem[] = [
  {
    id: 1,
    name: "Aïcha Mbarga",
    role: "Élève, Terminale D",
    school: "Lycée Leclerc, Yaoundé",
    contentKey: "Public.testimonials.items.1_content",
    rating: 5,
    initials: "AM",
    category: "student",
    accent: "primary",
  },
  {
    id: 2,
    name: "Paul Nkomo",
    role: "Parent d'élève",
    school: "Collège Bangué, Douala",
    contentKey: "Public.testimonials.items.2_content",
    rating: 5,
    initials: "PN",
    category: "parent",
    accent: "navy",
  },
  {
    id: 3,
    name: "Marie Foka",
    role: "Enseignante de Mathématiques",
    school: "Lycée de Bonabéri",
    contentKey: "Public.testimonials.items.3_content",
    rating: 5,
    initials: "MF",
    category: "teacher",
    accent: "emerald",
  },
  {
    id: 4,
    name: "Marc Atangana",
    role: "Directeur",
    school: "Institut Saint-Joseph",
    contentKey: "Public.testimonials.items.4_content",
    rating: 5,
    initials: "MA",
    category: "school",
    accent: "amber",
  },
  {
    id: 5,
    name: "Bérangère Talla",
    role: "Élève, 1ère C",
    school: "Lycée Bilingue de Bafoussam",
    contentKey: "Public.testimonials.items.5_content",
    rating: 5,
    initials: "BT",
    category: "student",
    accent: "primary",
  },
  {
    id: 6,
    name: "Mathurin Ngo",
    role: "Parent de 3 enfants",
    school: "École Privée La Sagesse",
    contentKey: "Public.testimonials.items.6_content",
    rating: 5,
    initials: "MN",
    category: "parent",
    accent: "rose",
  },
];

type Filter = "all" | "student" | "parent" | "teacher" | "school";

interface TestimonialsSectionProps {
  /** When true, hides the filter tabs (used on landing teaser). */
  compact?: boolean;
  /** Limit the number of items shown. */
  limit?: number;
}

/**
 * Testimonials section with category filters (§5.1).
 * Uses framer-motion for staggered reveal.
 * Names/schools are hardcoded (not translated); content is i18n.
 */
export function TestimonialsSection({
  compact = false,
  limit,
}: TestimonialsSectionProps) {
  const t = useTranslations();
  const [filter, setFilter] = React.useState<Filter>("all");

  const filtered = React.useMemo(() => {
    const items = compact
      ? ITEMS.slice(0, limit ?? 3)
      : ITEMS.filter((i) => filter === "all" || i.category === filter);
    return compact ? items : limit ? items.slice(0, limit) : items;
  }, [filter, compact, limit]);

  const filters: Filter[] = compact
    ? ["all"]
    : ["all", "student", "parent", "teacher", "school"];

  return (
    <div>
      {!compact && (
        <div
          role="tablist"
          aria-label="Filtres témoignages"
          className="mb-10 flex flex-wrap items-center justify-center gap-2"
        >
          {filters.map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(f)}
                className={
                  isActive
                    ? "inline-flex h-9 items-center justify-center rounded-lg bg-primary-500 px-4 text-sm font-medium text-primary-foreground shadow-[0_4px_16px_-4px_rgba(147,217,26,0.45)] transition"
                    : "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition hover:border-primary-500/40 hover:text-foreground"
                }
              >
                {t(`Public.testimonials.filters.${f}` as const)}
              </button>
            );
          })}
        </div>
      )}

      <motion.div
        layout
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {filtered.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <TestimonialCard
              name={item.name}
              role={item.role}
              school={item.school}
              content={t(item.contentKey as never)}
              rating={item.rating}
              avatarInitials={item.initials}
              accent={item.accent}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
