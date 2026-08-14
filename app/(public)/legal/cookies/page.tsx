import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicLayout } from "@/components/layout/public-layout";
import { LegalPageContent } from "@/components/public/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Public.seo");
  return {
    title: t("cookiesTitle"),
    description: t("cookiesDescription"),
    alternates: { canonical: "/legal/cookies" },
  };
}

export default async function CookiesPage() {
  return (
    <PublicLayout>
      <LegalPageContent namespace="cookies" />
    </PublicLayout>
  );
}
