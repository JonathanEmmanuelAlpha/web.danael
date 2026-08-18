import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Target, Sparkles, Zap, Trophy } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listTalentChallengesAction } from "@/server/actions/talent";
import type { TalentChallengeWithRelations } from "@/server/services/talent";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["teacher", "platform_admin", "content_moderator"] as const;

/**
 * §10.4 — Talent challenges listing (teacher view).
 *
 * Lists every talent challenge created by the current user (filtered
 * server-side by `createdBy = currentUser.id`).
 *
 * The list is rendered as a responsive grid of simple inline cards
 * showing the title, subject, skill, difficulty and publication badge.
 */
export default async function TeacherTalentChallengesPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  // Note: /teacher/layout.tsx already restricts access to the "teacher"
  // role. We keep this defensive allow-list check for the roles called
  // out by the task spec (in case the layout is relaxed later).
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    redirect("/teacher/dashboard");
  }

  const tNav = await getTranslations("Navigation");
  const tTalent = await getTranslations("Talent");
  const tCommon = await getTranslations("Common");

  const res = await listTalentChallengesAction({
    page: 1,
    pageSize: 24,
    createdBy: user.id,
  });

  const items: TalentChallengeWithRelations[] =
    res.success && res.data ? res.data.items : [];

  // Pre-resolve the few translated labels used inside the inline cards so
  // we don't need to await getTranslations per row.
  const labels = {
    published: tTalent("challengePublished"),
    draft: tTalent("challengeDraft"),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("talentChallenges")}
        description={tTalent("challengesDescription")}
        icon={<Target className="size-6" />}
        actions={
          <Button asChild variant="brand">
            <Link href="/teacher/talent-challenges/new">
              <Plus className="size-4" />
              {tTalent("newChallenge")}
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title={tTalent("challengeEmpty")}
          description={tTalent("challengeEmptyHint")}
          action={{
            label: tTalent("newChallenge"),
            href: "/teacher/talent-challenges/new",
          }}
        />
      ) : (
        <SectionCard
          title={tTalent("challengesTitle")}
          description={tTalent("challengesDescription")}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((challenge) => (
              <ChallengeRow
                key={challenge.id}
                challenge={challenge}
                labels={labels}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {tCommon("results")}: {items.length}
      </p>
    </div>
  );
}

/**
 * Simple inline card for a talent challenge:
 *  - title
 *  - subject + skill badges
 *  - difficulty + completions
 *  - publication status badge
 */
function ChallengeRow({
  challenge,
  labels,
}: {
  challenge: TalentChallengeWithRelations;
  labels: { published: string; draft: string };
}) {
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold leading-snug text-foreground">
          {challenge.title}
        </h3>
        {challenge.isPublished ? (
          <Badge variant="success" size="sm">
            {labels.published}
          </Badge>
        ) : (
          <Badge variant="warning" size="sm">
            {labels.draft}
          </Badge>
        )}
      </div>

      <p className="line-clamp-2 text-xs text-muted-foreground">
        {challenge.description}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
        <Badge variant="outline" size="sm">
          {challenge.subject.name}
        </Badge>
        <Badge variant="violet" size="sm">
          <Sparkles className="size-3" />
          {challenge.skill.name}
        </Badge>
        <Badge variant="info" size="sm">
          <Zap className="size-3" />
          {challenge.difficulty}/10
        </Badge>
        {challenge.completionsCount > 0 && (
          <Badge variant="secondary" size="sm">
            <Trophy className="size-3" />
            {challenge.completionsCount}
          </Badge>
        )}
      </div>
    </Card>
  );
}
