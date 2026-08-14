import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Library } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { ContentFilters } from "@/components/contents/content-filters";
import { LibraryContent } from "@/components/contents/library-content";
import { listSubjectsAction } from "@/server/actions/subjects";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";
import type { Subject } from "@/server/db/schema/schools";

export const dynamic = "force-dynamic";

/**
 * §5.4 — Student content library.
 *
 * - Public catalog (visibility = public, publicationStatus = published)
 * - Search bar + filters (type, level, series, subject, difficulty, sort)
 * - Grid of content cards
 */
export default async function LibraryPage() {
  const t = await getTranslations("Contents");
  const subjectsRes = await listSubjectsAction();
  const subjects: Subject[] = subjectsRes.success ? subjectsRes.data : [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={t("libraryTitle")}
          description={t("libraryDescription")}
          icon={<Library className="size-6" />}
        />
        <Suspense fallback={null}>
          <ContentFilters subjects={subjects} />
        </Suspense>
        <Suspense fallback={null}>
          <LibraryContent />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
