import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Sparkles,
  GitBranch,
  Brain,
  Briefcase,
  Users,
  Image as ImageIcon,
  Target,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { TdaWizardEntry } from "@/components/talent/tda-wizard";
import {
  TalentDnaCard,
  type TalentDnaData,
} from "@/components/talent/talent-dna-card";
import { TalentTrackCard } from "@/components/talent/talent-track-card";
import { FoundationAlertBlock } from "./_components/foundation-alert-block";

import {
  getTalentProfileAction,
  getCurrentTalentTrackAction,
  getActiveFloorAlertsAction,
} from "@/server/actions/talent";
import type { FloorAlertData } from "@/components/talent/foundation-alert";

/**
 * §10.4 — Student-facing Talent dashboard.
 *
 * If the student has not yet taken the TDA, renders the TDA wizard entry.
 * Otherwise shows: foundation alerts, Talent DNA card, weekly Talent Track
 * card, quick stats and a grid of navigation cards linking to the Talent
 * sub-pages (tree, mentor, career, cohorts, showcase).
 */
export default async function TalentDashboardPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");

  /* ── Fetch profile (early return if not assessed) ─────────────── */
  const profileRes = await getTalentProfileAction();
  const profile = profileRes.success ? profileRes.data : null;

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={tNav("talentDashboard")}
          description={tNav("talentDashboardDescription")}
          icon={<Sparkles className="size-6" />}
        />
        <TdaWizardEntry />
      </div>
    );
  }

  /* ── Fetch track + alerts in parallel ────────────────────────── */
  const [trackRes, alertsRes] = await Promise.all([
    getCurrentTalentTrackAction(),
    getActiveFloorAlertsAction(),
  ]);

  const track = trackRes.success ? trackRes.data : null;
  const alerts = alertsRes.success ? alertsRes.data : [];

  const alertIds = alerts.map((a) => a.id);
  const alertData: FloorAlertData[] = alerts.map((a) => ({
    skillId: a.skillId ?? "unknown",
    mastery: a.masteryAtAlert,
    breachCount: a.breachCount,
  }));

  /* ── Map profile → TalentDnaCard data ────────────────────────── */
  const dnaData: TalentDnaData = {
    cognitiveScores: profile.cognitiveScores ?? {},
    domainScores: profile.domainScores ?? {},
    creativityScore: profile.creativityScore,
    engagementScore: profile.engagementScore,
    overallTalentScore: profile.overallTalentScore,
    detectedZones: profile.detectedZones ?? [],
    growthZones: profile.growthZones ?? [],
    northStar: profile.northStar
      ? {
          id: profile.northStar.id,
          name: profile.northStar.name,
          difficulty: profile.northStar.difficulty,
        }
      : null,
    northStarTier: profile.northStarTier,
  };

  const overallPct = Math.round(profile.overallTalentScore * 100);

  /* ── Nav card config ─────────────────────────────────────────── */
  const navCards = [
    {
      href: "/student/talent/tree",
      label: tNav("talentTree"),
      description: tNav("talentTreeDescription"),
      icon: GitBranch,
      color: "text-violet-500",
    },
    {
      href: "/student/talent/mentor",
      label: tNav("socraticMentor"),
      description: tNav("socraticMentorDescription"),
      icon: Brain,
      color: "text-fuchsia-500",
    },
    {
      href: "/student/talent/career",
      label: tNav("careerHorizon"),
      description: tNav("careerHorizonDescription"),
      icon: Briefcase,
      color: "text-emerald-500",
    },
    {
      href: "/student/talent/cohorts",
      label: tNav("cohorts"),
      description: tNav("cohortsDescription"),
      icon: Users,
      color: "text-purple-500",
    },
    {
      href: "/student/talent/showcase",
      label: tNav("showcase"),
      description: tNav("showcaseDescription"),
      icon: ImageIcon,
      color: "text-pink-500",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("talentDashboard")}
        description={tNav("talentDashboardDescription")}
        icon={<Sparkles className="size-6" />}
      />

      {/* Foundation alerts */}
      <FoundationAlertBlock alerts={alertData} alertIds={alertIds} />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: DNA + Track */}
        <div className="space-y-6 lg:col-span-8">
          <TalentDnaCard data={dnaData} />

          {track ? (
            <TalentTrackCard track={track} />
          ) : (
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-6">
              <div className="flex flex-col items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
                  <Target className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold">
                    {tNav("myTrack")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tNav("myTrackDescription")}
                  </p>
                </div>
                <Button asChild variant="brand" size="sm">
                  <Link href="/student/talent/track">
                    <Sparkles className="size-4" />
                    {tNav("myTrack")}
                  </Link>
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Right column: quick stats + nav cards */}
        <div className="space-y-6 lg:col-span-4">
          {/* Quick stats */}
          <SectionCard title={tNav("talentDashboard")}>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="size-3" />
                    {tNav("talent")}
                  </span>
                  <span className="font-medium text-foreground">{overallPct}%</span>
                </div>
                <Progress value={overallPct} className="h-1.5" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {tNav("talentTree")}
                </span>
                <Badge variant="secondary" className="capitalize">
                  {profile.northStarTier}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {tNav("myTrack")}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {track ? track.challenges.length : "—"}
                </span>
              </div>

              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/student/talent/assessment">
                  <Sparkles className="size-3.5" />
                  {tNav("assessmentTitle")}
                </Link>
              </Button>
            </div>
          </SectionCard>

          {/* Nav cards */}
          <div className="space-y-3">
            {navCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group block focus:outline-none"
                >
                  <Card className="flex items-center gap-3 p-4 transition-all hover:shadow-md hover:border-primary-500/40">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/40 ${card.color}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {card.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {card.description}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
