import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, Check, UserPlus, SlidersHorizontal, Rocket, Trophy } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { HowItWorks } from "@/components/public/how-it-works";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Public.seo");
  return {
    title: t("howItWorksTitle"),
    description: t("howItWorksDescription"),
    alternates: { canonical: "/how-it-works" },
  };
}

interface DetailedStep {
  num: string;
  icon: typeof UserPlus;
  titleKey: string;
  descriptionKey: string;
  details: string[];
}

const DETAILED_STEPS: DetailedStep[] = [
  {
    num: "1",
    icon: UserPlus,
    titleKey: "step1Title",
    descriptionKey: "step1Description",
    details: [
      "Créez un compte avec votre adresse email",
      "Choisissez votre profil : élève, parent, enseignant ou établissement",
      "Recevez un email de vérification pour sécuriser votre compte",
      "Accédez à votre espace personnel en moins de 2 minutes",
    ],
  },
  {
    num: "2",
    icon: SlidersHorizontal,
    titleKey: "step2Title",
    descriptionKey: "step2Description",
    details: [
      "Rejoignez votre classe ou établissement via un code d'invitation",
      "Ajoutez vos matières et personnalisez vos objectifs",
      "Parents : reliez votre compte à celui de votre enfant en toute sécurité",
      "Enseignants : créez vos classes et invitez vos élèves",
    ],
  },
  {
    num: "3",
    icon: Rocket,
    titleKey: "step3Title",
    descriptionKey: "step3Description",
    details: [
      "Élèves : faites vos devoirs, jouez des quiz, gagnez des badges",
      "Parents : recevez des alertes et suivez la progression",
      "Enseignants : créez des contenus et corrigez automatiquement",
      "Établissements : pilotez l'engagement de votre communauté",
    ],
  },
  {
    num: "4",
    icon: Trophy,
    titleKey: "step4Title",
    descriptionKey: "step4Description",
    details: [
      "Mesurez vos progrès grâce aux statistiques détaillées",
      "Participez à des concours entre classes ou entre écoles",
      "Débloquez des badges et montez de niveau",
      "Atteignez vos objectifs et célébrez chaque victoire",
    ],
  },
];

export default async function HowItWorksPage() {
  const t = await getTranslations("Public.howItWorks");

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary-500/5 to-background px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-400">
            {t("title")}
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>
      </section>

      {/* Quick 3-step overview */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <HowItWorks />
        </div>
      </section>

      {/* Detailed steps */}
      <section className="border-y border-border bg-muted/30 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-4xl space-y-6">
          {DETAILED_STEPS.map((step) => (
            <Card key={step.num} className="overflow-hidden p-0">
              <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-8">
                <div className="flex items-start gap-4 sm:flex-col sm:items-center">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-[0_10px_30px_-8px_rgba(147,217,26,0.5)]">
                    <step.icon className="size-7" aria-hidden />
                  </div>
                  <div className="font-display text-3xl font-bold text-primary-600 dark:text-primary-400">
                    0{step.num}
                  </div>
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                    {t(step.titleKey as never)}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {t(step.descriptionKey as never)}
                  </p>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {step.details.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-primary-500/30 bg-primary-500/5 p-8 text-center sm:p-10">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {t("ctaTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t("ctaSubtitle")}
          </p>
          <Button asChild variant="brand" size="lg" className="mt-6">
            <Link href="/sign-up">
              {t("ctaButton")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
