import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ChevronLeft,
  Clock,
  Zap,
  Target,
  Sparkles,
  BookOpen,
} from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { SocraticMentorChat } from "@/components/talent/socratic-mentor-chat";
import { ChallengeSubmissionForm } from "./_components/challenge-submission-form";

import { getTalentChallengeAction } from "@/server/actions/talent";

/**
 * §10.4 — Talent challenge detail page.
 *
 * Layout:
 *  - PageHeader with the challenge title + back link.
 *  - Left column: problem statement (from payload), metadata, the
 *    submission form.
 *  - Right column: Socratic mentor chat.
 */
export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const { id } = await params;
  if (!id) notFound();

  const tNav = await getTranslations("Navigation");

  const res = await getTalentChallengeAction(id);
  if (!res.success || !res.data) {
    notFound();
  }
  const challenge = res.data;

  const problemStatement = challenge.payload?.problemStatement;

  return (
    <div className="space-y-6">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-2 text-muted-foreground"
        >
          <Link href="/student/talent/challenges">
            <ChevronLeft className="size-4" />
            {tNav("challengesLibrary")}
          </Link>
        </Button>
        <PageHeader
          title={challenge.title}
          description={challenge.description}
          icon={<Target className="size-6" />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <BookOpen className="size-3" />
                {challenge.skill.name}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Zap className="size-3" />
                {challenge.difficulty}/10
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />
                {challenge.estimatedMinutes} min
              </Badge>
              <Badge variant="outline" className="capitalize">
                {challenge.requiredTier}
              </Badge>
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: problem + submission form */}
        <div className="space-y-6 lg:col-span-7">
          {problemStatement ? (
            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-3.5" />
                {tNav("challengesLibrary")}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {problemStatement}
              </p>

              {challenge.payload?.steps &&
                challenge.payload.steps.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Steps
                    </p>
                    <ol className="list-inside list-decimal space-y-1 text-sm text-foreground">
                      {challenge.payload.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

              {challenge.payload?.hints &&
                challenge.payload.hints.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Hints
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {challenge.payload.hints.map((hint, idx) => (
                        <li key={idx}>{hint}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {challenge.solutionHint && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <strong>Hint:</strong> {challenge.solutionHint}
                </div>
              )}
            </Card>
          ) : null}

          <ChallengeSubmissionForm
            challengeId={challenge.id}
            challengeTitle={challenge.title}
            estimatedMinutes={challenge.estimatedMinutes}
          />
        </div>

        {/* Right: Socratic mentor chat */}
        <div className="lg:col-span-5">
          <SocraticMentorChat
            challengeId={challenge.id}
            skillId={challenge.skillId}
            skillName={challenge.skill.name}
          />
        </div>
      </div>
    </div>
  );
}
