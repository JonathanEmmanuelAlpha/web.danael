import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Brain } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MentorRecommendationCard } from "@/components/talent/mentor-recommendation-card";
import { GenerateMentorRecosButton } from "../_components/generate-mentor-recos-button";

import { listMentorRecommendationsAction } from "@/server/actions/talent";

/**
 * §10.4 — Mentor recommendations page.
 *
 * Lists the student's mentor recommendations (with the tutor info).
 * A button at the top lets the student trigger a fresh batch of
 * recommendations.
 */
export default async function MentorRecommendationsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");

  const recosRes = await listMentorRecommendationsAction();
  const recos = recosRes.success ? recosRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("socraticMentor")}
        description={tNav("socraticMentorDescription")}
        icon={<Brain className="size-6" />}
        actions={
          <GenerateMentorRecosButton variant="outline" size="sm" />
        }
      />

      {recos.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={tNav("socraticMentor")}
          description={tNav("socraticMentorDescription")}
        >
          <GenerateMentorRecosButton variant="brand" size="sm" className="mt-5" />
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recos.map((reco) => (
            <MentorRecommendationCard key={reco.id} reco={reco} />
          ))}
        </div>
      )}
    </div>
  );
}
