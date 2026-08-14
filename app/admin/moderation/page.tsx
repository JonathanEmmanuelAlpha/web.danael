import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
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
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (
    user.role !== "platform_admin" &&
    user.role !== "content_moderator"
  ) {
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
          title={t("moderation")}
          description={t("moderationDescription")}
          icon={<ShieldAlert className="size-6" />}
        />
        <SectionCard title={t("reports")} description={t("reportsHint")}>
          <ReportsList />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
