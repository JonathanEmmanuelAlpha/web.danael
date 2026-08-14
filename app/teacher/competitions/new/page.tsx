import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { CompetitionForm } from "@/components/gamification/competition-form";

/**
 * §5.7 — Create competition form page (teacher / school_admin / platform_admin).
 */
export default async function NewCompetitionPage() {
  const tComp = await getTranslations("Competitions");

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={tComp("newCompetition")}
          description={tComp("newCompetitionHint")}
          icon={<Trophy className="size-6" />}
        />
        <CompetitionForm />
      </div>
    </DashboardShell>
  );
}
