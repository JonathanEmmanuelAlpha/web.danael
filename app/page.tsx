import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { PublicHeader } from "@/components/public/header";
import { DashboardLinkButton } from "@/components/public/dashboard-link-button";
import { HeroSection } from "@/components/public/hero-section";
import { StatsBar } from "@/components/public/stats-bar";
import { FeaturesGrid } from "@/components/public/features-grid";
import { RoleBenefits } from "@/components/public/role-benefits";
import { HowItWorks } from "@/components/public/how-it-works";
import { TestimonialsSection } from "@/components/public/testimonials-section";
import { PartnerSchools } from "@/components/public/partner-schools";
import { FaqSection } from "@/components/public/faq-section";
import { FinalCta } from "@/components/public/final-cta";
import { Footer } from "@/components/public/footer";
import { Button } from "@/components/ui/button";

/**
 * Landing page (§5.1).
 *
 * Sections:
 *  1. Hero — headline + subheadline + CTAs + floating cards
 *  2. Stats bar — 4 key stats (social proof)
 *  3. Features — 6 feature cards
 *  4. Benefits by role — Tabs (student/parent/teacher/school)
 *  5. How it works — 3-step process
 *  6. Testimonials — filtered grid
 *  7. Partner schools — list
 *  8. Pricing teaser — link to /pricing
 *  9. FAQ teaser — accordion
 * 10. Final CTA
 * 11. Footer
 *
 * Includes JSON-LD structured data (Organization + WebSite).
 */
export default async function LandingPage() {
  const t = await getTranslations("Landing");
  const tNav = await getTranslations("Public.nav");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Danaël",
        url: "https://danael.app",
        logo: "https://danael.app/logo.svg",
        description: t("heroSubtitle"),
        foundingDate: "2024",
        address: {
          "@type": "PostalAddress",
          addressCountry: "CM",
          addressLocality: "Yaoundé",
        },
        sameAs: [
          "https://facebook.com/danael",
          "https://twitter.com/danael",
          "https://linkedin.com/company/danael",
        ],
      },
      {
        "@type": "WebSite",
        name: "Danaël",
        url: "https://danael.app",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://danael.app/search?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "Danaël",
        applicationCategory: "EducationApplication",
        operatingSystem: "Web",
        offers: [
          { "@type": "Offer", price: "0", priceCurrency: "XAF", name: "Free" },
          { "@type": "Offer", price: "2000", priceCurrency: "XAF", name: "Student" },
          { "@type": "Offer", price: "5000", priceCurrency: "XAF", name: "Family" },
        ],
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          reviewCount: "1247",
        },
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PublicHeader
        variant="dark"
        dashboardSlot={<DashboardLinkButton label={tNav("dashboard")} />}
      />

      <main className="flex-1">
        {/* 1. Hero */}
        <HeroSection />

        {/* 2. Stats bar */}
        <section
          aria-label={t("statsTitle")}
          className="border-b border-border bg-card px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {t("statsTitle")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                {t("statsSubtitle")}
              </p>
            </div>
            <StatsBar />
          </div>
        </section>

        {/* 3. Features */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-400">
                <Sparkles className="size-3.5" aria-hidden />
                {t("featuresTitle")}
              </div>
              <h2
                id="features-title"
                className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t("featuresTitle")}
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                {t("featuresSubtitle")}
              </p>
            </div>
            <FeaturesGrid />
          </div>
        </section>

        {/* 4. Benefits by role */}
        <section
          aria-labelledby="benefits-title"
          className="border-y border-border bg-muted/30 px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl text-center mx-auto">
              <h2
                id="benefits-title"
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t("benefitsTitle")}
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                {t("benefitsSubtitle")}
              </p>
            </div>
            <RoleBenefits />
          </div>
        </section>

        {/* 5. How it works */}
        <section
          aria-labelledby="how-title"
          className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 max-w-2xl mx-auto text-center">
              <h2
                id="how-title"
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t("howItWorksTitle")}
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                {t("howItWorksSubtitle")}
              </p>
            </div>
            <HowItWorks />
          </div>
        </section>

        {/* 6. Testimonials */}
        <section
          aria-labelledby="testimonials-title"
          className="border-y border-border bg-muted/30 px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl mx-auto text-center">
              <h2
                id="testimonials-title"
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t("testimonialsTitle")}
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                {t("testimonialsSubtitle")}
              </p>
            </div>
            <TestimonialsSection compact limit={3} />
            <div className="mt-10 text-center">
              <Button asChild variant="outline" size="lg">
                <Link href="/testimonials">
                  {t("seeAllTestimonials")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 7. Partner schools */}
        <section
          aria-labelledby="schools-title"
          className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl">
              <h2
                id="schools-title"
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t("partnerSchoolsTitle")}
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                {t("partnerSchoolsSubtitle")}
              </p>
            </div>
            <PartnerSchools />
          </div>
        </section>

        {/* 8. Pricing teaser */}
        <section
          aria-labelledby="pricing-title"
          className="border-y border-border bg-muted/30 px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2
                  id="pricing-title"
                  className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
                >
                  {t("pricingTeaserTitle")}
                </h2>
                <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                  {t("pricingTeaserSubtitle")}
                </p>
                <ul className="mt-6 space-y-2">
                  {[
                    t("heroCta"),
                    t("benefits.student.label"),
                    t("benefits.parent.label"),
                    t("benefits.teacher.label"),
                    t("benefits.school.label"),
                  ].map((line, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="size-4 text-primary-600 dark:text-primary-400" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="brand" size="lg" className="mt-6">
                  <Link href="/pricing">
                    {t("pricingTeaserCta")}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>

              {/* Plan preview cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Free", price: "0", accent: "primary", featured: false },
                  { name: "Student", price: "2 000", accent: "primary", featured: true },
                  { name: "Family", price: "5 000", accent: "navy", featured: false },
                  { name: "School", price: "Sur devis", accent: "navy", featured: false },
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className={
                      plan.featured
                        ? "relative rounded-2xl border-2 border-primary-500 bg-card p-4 shadow-float"
                        : "rounded-2xl border border-border bg-card p-4"
                    }
                  >
                    {plan.featured && (
                      <span className="absolute -top-2 right-3 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                        ★
                      </span>
                    )}
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {plan.name}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold text-foreground">
                      {plan.price}
                      {plan.price !== "Sur devis" && (
                        <span className="text-xs font-normal text-muted-foreground"> XAF/mois</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 9. FAQ teaser */}
        <section
          aria-labelledby="faq-title"
          className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl mx-auto text-center">
              <h2
                id="faq-title"
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {t("faqTeaserTitle")}
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                {t("faqTeaserSubtitle")}
              </p>
            </div>
            <FaqSection compact />
          </div>
        </section>

        {/* 10. Final CTA */}
        <FinalCta />
      </main>

      <Footer variant="default" />
    </div>
  );
}
