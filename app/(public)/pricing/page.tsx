import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PricingCards } from "@/components/billing/pricing-cards";
import { getPlanFeaturesAction } from "@/server/actions/payments";
import { getCurrentDbUser } from "@/lib/clerk";
import type { PlanDefinition } from "@/server/providers/payments/types";

/**
 * §5.13 — Public pricing page.
 *
 * Renders the 4 plan cards (free / essential / premium / institution) plus a
 * features comparison table and an FAQ-style section.
 */
export default async function PricingPage() {
  const t = await getTranslations("Billing");
  const tFeatures = await getTranslations("Billing.features");
  const user = await getCurrentDbUser();

  let plans: PlanDefinition[] = [];
  try {
    const res = await getPlanFeaturesAction();
    if (res.success) {
      plans = Array.isArray(res.data) ? res.data : [res.data];
    }
  } catch {
    // ignore — plans stays empty, UI shows fallback
  }

  // Collect all unique feature keys across plans (for comparison table).
  const featureKeys = Array.from(
    new Set(plans.flatMap((p) => p.features.map((f) => f.key))),
  );

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary-500/5 to-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="brand" className="mb-4">
            {t("badge")}
          </Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild variant="brand" size="lg">
              <Link href={user ? "/billing" : "/sign-up"}>
                {user ? t("goToBilling") : t("startFree")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#features">{t("comparePlans")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <PricingCards
            plans={plans}
            contactMode
          />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("paymentMethodsHint")} · {t("currency")}
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section id="features" className="border-t border-border bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {t("comparePlans")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("compareSubtitle")}</p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("feature")}
                  </th>
                  {plans.map((p) => (
                    <th
                      key={p.type}
                      className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {t(`plans.${p.type}.name` as const)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureKeys.map((key) => (
                  <tr key={key} className="border-b border-border/60">
                    <td className="py-3 text-foreground">{tFeatures(key as never)}</td>
                    {plans.map((p) => {
                      const f = p.features.find((x) => x.key === key);
                      const included = f?.included ?? false;
                      return (
                        <td key={p.type} className="px-4 py-3 text-center">
                          {included ? (
                            <Check className="mx-auto size-4 text-success" aria-label={t("yes")} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <h2 className="text-center font-display text-2xl font-bold text-foreground sm:text-3xl">
            {t("faqTitle")}
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground">{t("faq.paymentMethods")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("faq.paymentMethodsAnswer")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t("faq.cancelAnytime")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("faq.cancelAnytimeAnswer")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t("faq.familyPlan")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("faq.familyPlanAnswer")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t("faq.schoolPlan")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("faq.schoolPlanAnswer")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-primary-500/5 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-2xl font-bold text-foreground">{t("ctaTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("ctaSubtitle")}</p>
          <Button asChild variant="brand" size="lg" className="mt-6">
            <Link href={user ? "/billing" : "/sign-up"}>
              {user ? t("goToBilling") : t("startFree")}
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
