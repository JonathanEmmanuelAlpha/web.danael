import { getTranslations } from "next-intl/server";
import { CreditCard } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SubscriptionsTable } from "@/components/admin/subscriptions-table";

/**
 * §5.16 — Admin subscriptions page.
 *
 * Lists all platform subscriptions with status filter + pagination.
 */
export default async function AdminSubscriptionsPage() {
  const t = await getTranslations("Admin");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("subscriptions")}
          description={t("subscriptionsDescription")}
          icon={<CreditCard className="size-6" />}
        />
        <SectionCard
          title={t("subscriptions")}
          description={t("subscriptionsHint")}
        >
          <SubscriptionsTable />
        </SectionCard>
      </div>
    </>
  );
}
