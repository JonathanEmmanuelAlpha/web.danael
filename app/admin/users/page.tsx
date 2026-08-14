import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { UsersTable } from "@/components/admin/users-table";

/**
 * §5.16 — Admin users management.
 *
 * Lists all platform users with search, role filter, role-change dropdown
 * and a slide-over detail panel.
 */
export default async function AdminUsersPage() {
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
          title={t("users")}
          description={t("usersDescription")}
          icon={<Users className="size-6" />}
        />
        <SectionCard title={t("users")} description={t("usersHint")}>
          <UsersTable />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
