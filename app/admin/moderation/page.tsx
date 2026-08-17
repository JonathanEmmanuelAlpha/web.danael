import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ReportsList } from "@/components/admin/reports-list";

/**
 * §5.16 — Admin moderation page.
 *
 * Lists moderation reports with status + type filter, opens a detail
 * dialog with resolve / dismiss actions.
 */
export default async function AdminModerationPage() {
  const t = await getTranslations("Admin");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("moderation")}
          description={t("moderationDescription")}
          icon={<ShieldAlert className="size-6" />}
        />
        <SectionCard title={t("reports")} description={t("reportsHint")}>
          <ReportsList />
        </SectionCard>
      </div>
    </>
  );
}
