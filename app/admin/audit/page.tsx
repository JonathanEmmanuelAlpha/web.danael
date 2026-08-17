import { getTranslations } from "next-intl/server";
import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { AuditLogsTable } from "@/components/admin/audit-logs-table";

/**
 * §5.16 — Admin audit logs page.
 *
 * Append-only audit trail filtered by actor, action, entity type, and
 * date range. Visible only to platform_admin.
 */
export default async function AdminAuditPage() {
  const t = await getTranslations("Admin");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("audit")}
          description={t("auditDescription")}
          icon={<ClipboardList className="size-6" />}
        />
        <SectionCard title={t("auditLogs")} description={t("auditHint")}>
          <AuditLogsTable />
        </SectionCard>
      </div>
    </>
  );
}
