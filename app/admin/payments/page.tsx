import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
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
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "platform_admin" && user.role !== "support") {
    redirect("/dashboard");
  }

  const t = await getTranslations("Admin");
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell
      role={user.role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
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
