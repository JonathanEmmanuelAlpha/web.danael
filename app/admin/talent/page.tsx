import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Sparkles,
  Target,
  Users,
  ShieldAlert,
} from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";

export const dynamic = "force-dynamic";

/**
 * §10.4 — Talent System Health (admin).
 *
 * MVP overview of the talent system. For now, just renders 4 stat cards
 * with placeholder values (0). Real queries will be wired up via a
 * dedicated `getTalentSystemStatsAction`.
 *
 * TODO(real implementation):
 *   - Count of `talent_profiles` rows (students with a Talent DNA Card).
 *   - Count of `talent_challenges` rows (full library, including drafts).
 *   - Count of `talent_cohorts` rows (active cross-school cohorts).
 *   - Count of `floor_alerts` rows where status = "open".
 *   Plus trend indicators vs last week.
 */
export default async function AdminTalentPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");
  if (user.role !== "platform_admin") redirect("/admin/dashboard");

  const t = await getTranslations("Admin");

  // TODO: replace with `await getTalentSystemStatsAction()` once wired up.
  const stats = {
    totalProfiles: 0,
    totalChallenges: 0,
    totalCohorts: 0,
    floorAlerts: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("talentSystemHealth")}
        description={t("talentSystemHealthHint")}
        icon={<Sparkles className="size-6" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("talentStatTotalProfiles")}
          value={stats.totalProfiles}
          icon={Users}
          accent="primary"
          hint={t("talentStatTotalProfilesHint")}
        />
        <StatCard
          label={t("talentStatTotalChallenges")}
          value={stats.totalChallenges}
          icon={Target}
          accent="blue"
          hint={t("talentStatTotalChallengesHint")}
        />
        <StatCard
          label={t("talentStatTotalCohorts")}
          value={stats.totalCohorts}
          icon={Users}
          accent="emerald"
          hint={t("talentStatTotalCohortsHint")}
        />
        <StatCard
          label={t("talentStatFloorAlerts")}
          value={stats.floorAlerts}
          icon={ShieldAlert}
          accent={stats.floorAlerts > 0 ? "rose" : "amber"}
          hint={t("talentStatFloorAlertsHint")}
        />
      </div>
    </div>
  );
}
