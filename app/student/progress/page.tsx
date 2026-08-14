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
import type { UserRole } from "@/types";

/**
 * §5.8 — Progress page: XP, level, streak, weekly goals, activity feed, and
 * the global leaderboard.
 */
export default async function ProgressPage() {
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

  const tProg = await getTranslations("Gamification");
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <div className="space-y-6">
        <PageHeader
          title={tProg("progress")}
          description={tProg("progressDescription")}
          icon={<TrendingUp className="size-6" />}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <XpCard userId={user.id} />
          <StreakCard userId={user.id} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title={tProg("weeklyGoals")} icon={<Target className="size-4" />}>
            <WeeklyGoals userId={user.id} />
          </SectionCard>
          <SectionCard
            title={tProg("activities")}
            icon={<Activity className="size-4" />}
            description={tProg("activitiesHint")}
          >
            <ActivityFeed userId={user.id} limit={15} />
          </SectionCard>
        </div>

        <SectionCard
          title={tProg("leaderboard")}
          icon={<Trophy className="size-4" />}
          description={tProg("leaderboardHint")}
        >
          <LeaderboardTable scope="global" currentUserId={user.id} />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
