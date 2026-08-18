import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CohortCard } from "@/components/talent/cohort-card";

import { listAvailableCohortsAction } from "@/server/actions/talent";

/**
 * §10.4 — Cross-school Talent Cohorts page.
 *
 * Lists every active cohort with the student's membership state and
 * current member count.
 */
export default async function CohortsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");

  const cohortsRes = await listAvailableCohortsAction();
  const cohorts = cohortsRes.success ? cohortsRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("cohorts")}
        description={tNav("cohortsDescription")}
        icon={<Users className="size-6" />}
      />

      {cohorts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tNav("cohorts")}
          description={tNav("cohortsDescription")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cohorts.map(({ cohort, isMember, memberCount }) => (
            <CohortCard
              key={cohort.id}
              cohort={cohort}
              isMember={isMember}
              memberCount={memberCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
