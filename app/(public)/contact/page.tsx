import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { ContactForm } from "@/components/public/contact-form";
import { Card } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Public.seo");
  return {
    title: t("contactTitle"),
    description: t("contactDescription"),
    alternates: { canonical: "/contact" },
  };
}

interface ContactInfo {
  icon: typeof Mail;
  label: string;
  value: string;
}

export default async function ContactPage() {
  const t = await getTranslations("Public.contact");

  const infos: ContactInfo[] = [
    {
      icon: Mail,
      label: "Email",
      value: "hello@danael.app",
    },
    {
      icon: Phone,
      label: "Téléphone",
      value: "+237 6 90 00 00 00",
    },
    {
      icon: MapPin,
      label: "Adresse",
      value: "Yaoundé, Cameroun",
    },
    {
      icon: Clock,
      label: "Réponse",
      value: "Sous 24h ouvrées",
    },
  ];

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

      {/* Contact form + infos */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3">
            <Card className="p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                {t("title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
              <div className="mt-6">
                <ContactForm />
              </div>
            </Card>
          </div>

          {/* Infos */}
          <div className="lg:col-span-2">
            <Card className="p-6 sm:p-8">
              <h3 className="font-display text-base font-semibold text-foreground">
                Informations
              </h3>
              <ul className="mt-4 space-y-4">
                {infos.map((info) => (
                  <li key={info.label} className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-400">
                      <info.icon className="size-5" aria-hidden />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {info.label}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{info.value}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="mt-6 rounded-2xl border border-primary-500/30 bg-primary-500/5 p-6">
              <p className="text-sm font-semibold text-foreground">
                {t("demoRequest")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("demoRequestHint")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
