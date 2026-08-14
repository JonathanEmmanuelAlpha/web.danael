import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicLayout } from "@/components/layout/public-layout";
import { LegalPageContent } from "@/components/public/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Public.seo");
  return {
    title: t("legalTitle"),
    description: t("legalDescription"),
    alternates: { canonical: "/legal" },
  };
}

export default async function LegalPage() {
  return (
    <PublicLayout>
      <LegalPageContent namespace="legal" />
    </PublicLayout>
  );
}
