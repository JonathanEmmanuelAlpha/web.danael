import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";

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
  const t = await getTranslations("Admin");

  return (
    <>
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
    </>
  );
}
