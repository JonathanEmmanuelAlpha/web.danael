import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicLayout } from "@/components/layout/public-layout";
import { TestimonialsSection } from "@/components/public/testimonials-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Public.seo");
  return {
    title: t("testimonialsTitle"),
    description: t("testimonialsDescription"),
    alternates: { canonical: "/testimonials" },
  };
}

export default async function TestimonialsPage() {
  const t = await getTranslations("Public.testimonials");

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary-500/5 to-background px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>
      </section>

      {/* All testimonials with filters */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <TestimonialsSection />
        </div>
      </section>
    </PublicLayout>
  );
}
