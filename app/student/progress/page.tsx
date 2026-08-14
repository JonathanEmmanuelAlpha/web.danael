import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Activity, Target, TrendingUp, Trophy } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { XpCard } from "@/components/gamification/xp-card";
import { StreakCard } from "@/components/gamification/streak-card";
import { WeeklyGoals } from "@/components/gamification/weekly-goals";
import { ActivityFeed } from "@/components/gamification/activity-feed";
import { LeaderboardTable } from "@/components/gamification/leaderboard-table";
import {
  getActivitiesAction,
  getGoalsAction,
  getLeaderboardAction,
  getPointsAction,
  getStreakAction,
} from "@/server/actions/gamification";

/**
 * §5.8 — Progress page: XP, level, streak, weekly goals, activity feed, and
 * the global leaderboard.
 */
export default async function ProgressPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const tProg = await getTranslations("Gamification");

  const streakData = await getStreakAction();
  const goalsData = await getGoalsAction();
  const leaderBoradData = await getLeaderboardAction({
    scope: "global",
    limit: 50,
  });
  const activities = await getActivitiesAction(15);
  const xpData = await getPointsAction();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={tProg("progress")}
          description={tProg("progressDescription")}
          icon={<TrendingUp className="size-6" />}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <XpCard
            data={xpData.success ? xpData.data : null}
            error={!xpData.success ? xpData.error : null}
          />
          <StreakCard
            streakData={streakData.success ? streakData.data : null}
            error={!streakData.success ? streakData.error : null}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title={tProg("weeklyGoals")}
            icon={<Target className="size-4" />}
          >
            <WeeklyGoals
              data={goalsData.success ? goalsData.data : null}
              error={!goalsData.success ? goalsData.error : null}
            />
          </SectionCard>
          <SectionCard
            title={tProg("activities")}
            icon={<Activity className="size-4" />}
            description={tProg("activitiesHint")}
          >
            <ActivityFeed
              data={activities.success ? activities.data : null}
              error={!activities.success ? activities.error : null}
            />
          </SectionCard>
        </div>

        <SectionCard
          title={tProg("leaderboard")}
          icon={<Trophy className="size-4" />}
          description={tProg("leaderboardHint")}
        >
          <LeaderboardTable
            data={leaderBoradData.success ? leaderBoradData.data.entries : null}
            error={!leaderBoradData.success ? leaderBoradData.error : null}
            currentUserId={user.id}
          />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
