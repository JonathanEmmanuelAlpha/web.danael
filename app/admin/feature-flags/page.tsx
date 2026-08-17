import { getTranslations } from "next-intl/server";
import { Flag } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { FeatureFlagsList } from "@/components/admin/feature-flags-list";

/**
 * §5.16 — Admin feature flags page.
 *
 * Lists all feature flags with toggle switches + create dialog. Visible
 * only to platform_admin.
 */
export default async function AdminFeatureFlagsPage() {
  const t = await getTranslations("Admin");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("featureFlags")}
          description={t("featureFlagsDescription")}
          icon={<Flag className="size-6" />}
        />
        <SectionCard
          title={t("featureFlags")}
          description={t("featureFlagsHint")}
        >
          <FeatureFlagsList />
        </SectionCard>
      </div>
    </>
  );
}
