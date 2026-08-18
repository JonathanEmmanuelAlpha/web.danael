import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Target } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { TalentChallengeCard } from "@/components/talent/talent-challenge-card";
import { GenerateTrackButton } from "../_components/generate-track-button";
import { TalentTrackCardWithGenerate } from "./_components/talent-track-card-with-generate";

import { getCurrentTalentTrackAction } from "@/server/actions/talent";
import type { TalentSubmissionStatusValue } from "@/server/db/schema/talent";

/**
 * §10.4 — Weekly Talent Track page.
 */
export default async function TalentTrackPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");

  const trackRes = await getCurrentTalentTrackAction();
  const track = trackRes.success ? trackRes.data : null;

  /* ── Build challenge cards from the track ─────────────────────── */
  const challenges = track?.challenges ?? [];
  const progressByChallenge = new Map(
    (track?.progress ?? []).map((p) => [p.challengeId, p.status] as const),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("myTrack")}
        description={tNav("myTrackDescription")}
        icon={<Target className="size-6" />}
        actions={
          <GenerateTrackButton
            force
            variant="outline"
            size="sm"
            label={tNav("generateTrack")}
          />
        }
      />

      <TalentTrackCardWithGenerate track={track} />

      {challenges.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => {
            const status = progressByChallenge.get(challenge.id);
            return (
              <TalentChallengeCard
                key={challenge.id}
                challenge={{
                  ...challenge,
                  subject: { id: challenge.subjectId, name: "", code: "" },
                  skill: {
                    id: challenge.skillId,
                    name: "",
                    difficulty: "medium",
                  },
                  creator: null,
                }}
                submissionStatus={
                  status as TalentSubmissionStatusValue | undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

