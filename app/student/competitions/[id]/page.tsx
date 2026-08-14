import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarClock, Gift, Users, Trophy } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { JoinCompetitionButton } from "@/components/gamification/join-competition-button";
import { CompetitionLeaderboard } from "@/components/gamification/competition-leaderboard";
import { getCompetitionAction } from "@/server/actions/competitions";
import type { UserRole } from "@/types";

/**
 * §5.7 — Competition detail page (student view).
 *
 * Shows: competition metadata, prize, "Join" button (or scoreboard submission
 * form if joined), and the live ranked leaderboard.
 */
export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  if (
    role !== "student" &&
    role !== "tutor" &&
    role !== "teacher"
  ) {
    redirect("/dashboard");
  }

  const tComp = await getTranslations("Competitions");
  const tCommon = await getTranslations("Common");
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  const res = await getCompetitionAction(id);
  if (!res.success) {
    return (
      <DashboardShell
        role={role}
        userName={userName}
        userImage={user.avatarUrl ?? undefined}
      >
        <EmptyState
          icon={Trophy}
          title={tComp("notFound")}
          description={tComp("notFoundHint")}
          action={{ label: tCommon("back"), href: "/competitions" }}
        />
      </DashboardShell>
    );
  }

  const competition = res.data;
  const now = new Date();
  const hasEnded = now > competition.endAt || competition.status === "ended" || competition.status === "cancelled";
  const isActive =
    competition.status === "active" &&
    now >= competition.startAt &&
    now <= competition.endAt;

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <div className="space-y-6">
        <PageHeader
          title={competition.title}
          description={competition.description ?? undefined}
          icon={<Trophy className="size-6" />}
          actions={
            <JoinCompetitionButton
              competitionId={competition.id}
              disabled={hasEnded}
            />
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden />
              {tComp("dates")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formatDate(competition.startAt)} → {formatDate(competition.endAt)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Users className="size-3.5" aria-hidden />
              {tComp("participantsLabel")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {tComp("participantsCount", { count: competition.participantsCount })}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Trophy className="size-3.5" aria-hidden />
              {tComp("scopeLabel")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {tComp(`scope.${competition.scope}`)}
              {competition.level ? ` · ${competition.level}` : null}
              {competition.series ? ` · ${competition.series}` : null}
            </p>
          </div>
        </div>

        {competition.prizeDescription ? (
          <SectionCard title={tComp("prize")} icon={<Gift className="size-4" />}>
            <p className="text-sm text-muted-foreground">
              {competition.prizeDescription}
            </p>
          </SectionCard>
        ) : null}

        <SectionCard
          title={tComp("leaderboard")}
          icon={<Trophy className="size-4" />}
          description={
            isActive
              ? tComp("leaderboardLiveHint")
              : hasEnded
                ? tComp("leaderboardFinalHint")
                : tComp("leaderboardPendingHint")
          }
        >
          <CompetitionLeaderboard
            competitionId={competition.id}
            allowSubmission={isActive}
          />
        </SectionCard>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" size="sm">
            {tComp(`status.${competition.status}`)}
          </Badge>
          {hasEnded ? (
            <span>{tComp("endedHint")}</span>
          ) : isActive ? (
            <span>{tComp("activeHint")}</span>
          ) : (
            <span>{tComp("upcomingHint")}</span>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
