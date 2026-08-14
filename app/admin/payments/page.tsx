import { getTranslations } from "next-intl/server";
import { DollarSign } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { PaymentsTable } from "@/components/admin/payments-table";

/**
 * §5.16 — Admin payments page.
 *
 * Lists all platform payments with status + provider filter + pagination.
 */
export default async function AdminPaymentsPage() {
  const t = await getTranslations("Admin");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={t("payments")}
          description={t("paymentsDescription")}
          icon={<DollarSign className="size-6" />}
        />
        <SectionCard title={t("payments")} description={t("paymentsHint")}>
          <PaymentsTable />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
