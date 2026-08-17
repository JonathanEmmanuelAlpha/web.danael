import { getTranslations } from "next-intl/server";
import { School as SchoolIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SchoolsTable } from "@/components/admin/schools-table";

/**
 * §5.16 — Admin schools management.
 *
 * Lists all schools with verify/unverify action + filter by verification
 * status + search.
 */
export default async function AdminSchoolsPage() {
  const t = await getTranslations("Admin");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("schools")}
          description={t("schoolsDescription")}
          icon={<SchoolIcon className="size-6" />}
        />
        <SectionCard title={t("schools")} description={t("schoolsHint")}>
          <SchoolsTable />
        </SectionCard>
      </div>
    </>
  );
}
