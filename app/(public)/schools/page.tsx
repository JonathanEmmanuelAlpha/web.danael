import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Building2, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { SchoolsExplorer } from "@/components/schools/schools-explorer";
import { listSchoolsFTSAction } from "@/server/actions/schools";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Public.seo");
  return {
    title: t("schoolsTitle"),
    description: t("schoolsDescription"),
    alternates: { canonical: "/schools" },
  };
}

export default async function SchoolsPage() {
  const t = await getTranslations("Schools");

  // Server-side fetch of the first page (12 items) — passed to the client
  // explorer as `initialPage` so it can hydrate without an extra round-trip.
  const result = await listSchoolsFTSAction({
    page: 1,
    pageSize: 12,
  });

  const initialPage = result.success
    ? result.data
    : {
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        hasMore: false,
      };

  return (
    <PublicLayout>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        {/* Aurora background + halos */}
        <div
          aria-hidden
          className="aurora-bg pointer-events-none absolute inset-0 opacity-60"
        />
        <div
          aria-hidden
          className="halo-lime pointer-events-none absolute -top-32 left-1/4 size-96 -translate-x-1/2 opacity-70"
        />
        <div
          aria-hidden
          className="halo-violet pointer-events-none absolute -top-24 right-1/4 size-80 opacity-60"
        />

        <div className="relative mx-auto max-w-7xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-300 backdrop-blur-md animate-scale-in">
            <Sparkles className="size-3.5" aria-hidden />
            {t("exploreSchools")}
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl animate-fade-up">
            <span className="text-gradient-aurora">{t("exploreSchools")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg animate-fade-up">
            {t("exploreSchoolsSubtitle")}
          </p>
        </div>
      </section>

      {/* ── Explorer (infinite scroll + filters) ─────────────── */}
      <section className="relative px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-300 ring-1 ring-primary-500/20">
              <Building2 className="size-5" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {t("exploreSchools")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("exploreSchoolsSubtitle")}
              </p>
            </div>
          </div>

          <SchoolsExplorer initialPage={initialPage} />
        </div>
      </section>
    </PublicLayout>
  );
}
