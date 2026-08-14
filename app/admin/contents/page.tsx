import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { getTranslations } from "next-intl/server";
import { FolderOpen } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ContentsTable } from "@/components/admin/contents-table";

/**
 * §5.16 — Admin contents moderation.
 *
 * Lists all contents with visibility filter + remove (archive) action.
 * Visible to platform_admin and content_moderator.
 */
export default async function AdminContentsPage() {
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
          title={t("contents")}
          description={t("contentsDescription")}
          icon={<FolderOpen className="size-6" />}
        />
        <SectionCard title={t("contents")} description={t("contentsHint")}>
          <ContentsTable />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
