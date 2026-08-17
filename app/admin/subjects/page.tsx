import { getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SubjectsManager } from "@/components/admin/subjects-manager";

/**
 * §5.16 — Admin subjects catalog management.
 *
 * Platform-wide subject catalog (Maths, Physique, SVT…). Subjects are shared
 * across all schools — they can be assigned to individual classes with a
 * coefficient and a teacher.
 *
 * Rendered inside <AdminLayout> which provides <DashboardShell>.
 */
export default async function AdminSubjectsPage() {
  const t = await getTranslations("Admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("subjects")}
        description={t("subjectsDescription")}
        icon={<BookOpen className="size-6" />}
      />
      <SectionCard
        title={t("subjects")}
        description={t("subjectsPlatformHint")}
      >
        <SubjectsManager schoolScoped={false} />
      </SectionCard>
    </div>
  );
}
