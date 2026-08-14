import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { getTranslations } from "next-intl/server";
import { CreditCard } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { SubscriptionsTable } from "@/components/admin/subscriptions-table";

/**
 * §5.16 — Admin subscriptions page.
 *
 * Lists all platform subscriptions with status filter + pagination.
 */
export default async function AdminSubscriptionsPage() {
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
    </DashboardShell>
  );
}
