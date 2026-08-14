import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { ChildrenList } from "@/components/parent/children-list";
import { Baby } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

/**
 * §5.14 — Parent children list page.
 *
 * Lists every student linked to the current parent. Allows linking
 * a new child via the dialog.
 */
export default async function ChildrenPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "parent" && user.role !== "platform_admin") {
    redirect("/dashboard");
  }

  const t = await getTranslations("Parent");
  const tNav = await getTranslations("Navigation");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          title={tNav("children")}
          description={t("myChildrenDescription")}
          icon={<Baby className="size-6" />}
        />
        <ChildrenList />
      </div>
    </DashboardShell>
  );
}
