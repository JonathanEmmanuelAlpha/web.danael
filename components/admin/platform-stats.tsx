"use client";

/**
 * §5.16 — Platform stats overview card.
 *
 * Displays 6 KPI tiles: total users, total schools, total contents, active
 * subscriptions, total revenue, pending moderation reports.
 *
 * Fetches its data on mount via `getPlatformStatsAction`.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Users,
  School as SchoolIcon,
  FileText,
  CreditCard,
  DollarSign,
  ShieldAlert,
} from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { PageLoader } from "@/components/shared/loading";
import { getPlatformStatsAction } from "@/server/actions/admin";
import type { PlatformStats } from "@/server/services/admin";

export function PlatformStatsCards() {
  const t = useTranslations("Admin");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [fetchStarted, setFetchStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlatformStatsAction()
      .then((res) => {
        if (cancelled) return;
        if (res.success) setStats(res.data);
      })
      .finally(() => {
        if (!cancelled) setFetchStarted(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fetchStarted || !stats) {
    return <PageLoader label={t("loadingStats")} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label={t("totalUsers")}
        value={stats.totalUsers}
        icon={Users}
        accent="primary"
        hint={t("totalUsersHint")}
      />
      <StatCard
        label={t("totalSchools")}
        value={stats.totalSchools}
        icon={SchoolIcon}
        accent="emerald"
        hint={t("totalSchoolsHint")}
      />
      <StatCard
        label={t("totalContents")}
        value={stats.totalContents}
        icon={FileText}
        accent="blue"
      />
      <StatCard
        label={t("activeSubscriptions")}
        value={stats.activeSubscriptions}
        icon={CreditCard}
        accent="primary"
      />
      <StatCard
        label={t("revenue")}
        value={`${new Intl.NumberFormat("fr-FR").format(stats.totalRevenue)} XOF`}
        icon={DollarSign}
        accent="emerald"
      />
      <StatCard
        label={t("pendingReports")}
        value={stats.pendingReports}
        icon={ShieldAlert}
        accent={stats.pendingReports > 0 ? "rose" : "primary"}
      />
    </div>
  );
}
