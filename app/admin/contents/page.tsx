import { getTranslations } from "next-intl/server";
import { FolderOpen } from "lucide-react";

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
  const t = await getTranslations("Admin");

  return (
    <>
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
    </>
  );
}
