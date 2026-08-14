import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { SchoolHero } from "@/components/schools/school-hero";
import { SchoolClassesExplorer } from "@/components/schools/school-classes-explorer";
import {
  getSchoolDetailAction,
  getSchoolClassesAction,
} from "@/server/actions/schools";

interface SchoolDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SchoolDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("Public.seo");
  const result = await getSchoolDetailAction({ schoolId: id });
  if (!result.success || !result.data) {
    return {
      title: t("schoolsTitle"),
      description: t("schoolsDescription"),
    };
  }
  return {
    title: result.data.school.name,
    description: result.data.school.city
      ? `${result.data.school.name} — ${result.data.school.city}`
      : result.data.school.name,
    alternates: { canonical: `/schools/${id}` },
  };
}

export default async function SchoolDetailPage({
  params,
}: SchoolDetailPageProps) {
  const { id } = await params;
  const t = await getTranslations("Schools");

  // Server-side fetch of the school detail (with the first page of classes).
  const detailResult = await getSchoolDetailAction({ schoolId: id });

  if (!detailResult.success || !detailResult.data) {
    notFound();
  }

  const { school } = detailResult.data;

  // Fetch the first page of classes (with total + hasMore) — the explorer
  // hydrates from this initial data without an extra round-trip.
  const classesPageResult = await getSchoolClassesAction({
    schoolId: id,
    page: 1,
    pageSize: 12,
  });
  const classesInitialPage = classesPageResult.success
    ? classesPageResult.data
    : {
        items: detailResult.data.classes,
        total: detailResult.data.classes.length,
        page: 1,
        hasMore: false,
      };

  return (
    <PublicLayout>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SchoolHero school={school} />
        </div>
      </section>

      {/* ── Classes ──────────────────────────────────────────── */}
      <section className="relative px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent-violet-500/10 text-accent-violet-400 ring-1 ring-accent-violet-500/20">
              <BookOpen className="size-5" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {t("classesOf", { name: school.name })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {classesInitialPage.total}{" "}
                {t("members").toLowerCase()}
              </p>
            </div>
          </div>

          <SchoolClassesExplorer
            schoolId={id}
            initialPage={classesInitialPage}
          />
        </div>
      </section>
    </PublicLayout>
  );
}
