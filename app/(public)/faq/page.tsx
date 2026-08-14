import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { FaqSection } from "@/components/public/faq-section";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Public.seo");
  return {
    title: t("faqTitle"),
    description: t("faqDescription"),
    alternates: { canonical: "/faq" },
  };
}

export default async function FaqPage() {
  const t = await getTranslations("Public.faq");

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

      {/* FAQ */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <FaqSection />
        </div>
      </section>

      {/* Still have questions CTA */}
      <section className="border-t border-border bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
            Vous ne trouvez pas votre réponse ?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Notre équipe vous répond sous 24 heures.
          </p>
          <Button asChild variant="brand" size="lg" className="mt-6">
            <Link href="/contact">
              Contactez-nous
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
