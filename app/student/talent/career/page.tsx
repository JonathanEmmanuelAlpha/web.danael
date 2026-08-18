import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Briefcase } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CareerCard } from "@/components/talent/career-card";
import { MatchCareersButton } from "../_components/match-careers-button";

import { listCareerMatchesAction } from "@/server/actions/talent";

/**
 * §10.4 — Career Horizon page.
 *
 * Lists the careers matched to the student's Talent DNA Card. A
 * button at the top lets the student re-run the NLP matcher.
 */
export default async function CareerHorizonPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");

  const matchesRes = await listCareerMatchesAction();
  const matches = matchesRes.success ? matchesRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("careerHorizon")}
        description={tNav("careerHorizonDescription")}
        icon={<Briefcase className="size-6" />}
        actions={<MatchCareersButton variant="outline" size="sm" />}
      />

      {matches.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={tNav("careerHorizon")}
          description={tNav("careerHorizonDescription")}
        >
          <MatchCareersButton variant="brand" size="sm" className="mt-5" />
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <CareerCard key={match.id} career={match} />
          ))}
        </div>
      )}
    </div>
  );
}
