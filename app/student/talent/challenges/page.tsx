import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TalentChallengeCard } from "@/components/talent/talent-challenge-card";

import { listTalentChallengesAction } from "@/server/actions/talent";

/**
 * §10.4 — Browse all published talent challenges.
 *
 * Renders a responsive grid of `TalentChallengeCard`s. Pagination is
 * not exposed in the UI yet — we fetch the first page (24 items).
 */
export default async function ChallengesLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ skillId?: string; subjectId?: string }>;
}) {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");
  const sp = (await searchParams) ?? {};

  const res = await listTalentChallengesAction({
    page: 1,
    pageSize: 24,
    isPublished: true,
    skillId: sp.skillId,
    subjectId: sp.subjectId,
  });
  const items = res.success ? res.data.items : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("challengesLibrary")}
        description={tNav("challengesLibraryDescription")}
        icon={<Trophy className="size-6" />}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={tNav("challengesLibrary")}
          description={tNav("challengesLibraryDescription")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((challenge) => (
            <TalentChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      )}
    </div>
  );
}
