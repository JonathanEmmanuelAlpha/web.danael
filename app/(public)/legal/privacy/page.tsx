import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicLayout } from "@/components/layout/public-layout";
import { LegalPageContent } from "@/components/public/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Public.seo");
  return {
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    alternates: { canonical: "/legal/privacy" },
  };
}

export default async function PrivacyPage() {
  return (
    <PublicLayout>
      <LegalPageContent namespace="privacy" />
    </PublicLayout>
  );
}
