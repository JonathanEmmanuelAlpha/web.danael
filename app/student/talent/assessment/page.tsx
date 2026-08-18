import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Brain } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { TdaWizardEntry } from "@/components/talent/tda-wizard";

/**
 * §10.4 — Talent Discovery Assessment entry page.
 *
 * Renders the TDA wizard entry. Used both for the first assessment and
 * for retaking the assessment (the action will upsert the talent
 * profile on completion).
 */
export default async function TalentAssessmentPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={tNav("assessmentTitle")}
        description={tNav("assessmentDescription")}
        icon={<Brain className="size-6" />}
      />
      <TdaWizardEntry />
    </div>
  );
}
