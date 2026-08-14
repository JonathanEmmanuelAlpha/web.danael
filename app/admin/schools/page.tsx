import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { getTranslations } from "next-intl/server";
import { School as SchoolIcon } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
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
          title={t("schools")}
          description={t("schoolsDescription")}
          icon={<SchoolIcon className="size-6" />}
        />
        <SectionCard title={t("schools")} description={t("schoolsHint")}>
          <SchoolsTable />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
