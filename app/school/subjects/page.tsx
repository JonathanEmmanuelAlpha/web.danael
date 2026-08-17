import { getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SubjectsManager } from "@/components/admin/subjects-manager";

/**
 * §5.3 — School subjects catalog management.
 *
 * School admins can view and manage the global subject catalog. Subjects are
 * shared across all schools — they can be assigned to the school's classes
 * with a coefficient and a teacher via the class detail page.
 *
 * Rendered inside <SchoolLayout> which provides <DashboardShell>.
 */
export default async function SchoolSubjectsPage() {
  const t = await getTranslations("Admin");
  const tNav = await getTranslations("Navigation");

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("subjects")}
        description={t("subjectsDescription")}
        icon={<BookOpen className="size-6" />}
      />
      <SectionCard
        title={tNav("subjects")}
        description={t("subjectsSchoolHint")}
      >
        <SubjectsManager schoolScoped />
      </SectionCard>
    </div>
  );
}
