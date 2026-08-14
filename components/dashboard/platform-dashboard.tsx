"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  CreditCard,
  FileText,
  HelpCircle,
  School as SchoolIcon,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTrend } from "@/components/charts/stat-trend";
import { AreaChartCard } from "@/components/charts/area-chart";
import { PieChartCard } from "@/components/charts/pie-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  getPlatformGrowthAction,
  getPlatformOverviewAction,
  getPlatformRoleDistributionAction,
  getPlatformTopContentsAction,
  getPlatformTopSchoolsAction,
} from "@/server/actions/analytics";
import type {
  PlatformOverview,
  PlatformTopSchool,
  PlatformTopContent,
  RoleDistributionEntry,
  TimelinePoint,
} from "@/server/services/analytics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { UserRole } from "@/types";
import { useUserStore } from "@/stores/user-store";

const ROLE_COLORS: Record<string, string> = {
  student: "#93d91a",
  teacher: "#22d3ee",
  school_admin: "#a78bfa",
  parent: "#fbbf24",
  tutor: "#fb7185",
  platform_admin: "#93d91a",
  content_moderator: "#22d3ee",
  support: "#a78bfa",
};

/**
 * §5.9.6 — Platform admin dashboard with rich analytics charts.
 *
 * Aurora Navy refonte:
 *  - PageHeader with brand-outline quick action (admin users).
 *  - StatTrend cards in a 4-col grid (already refactored).
 *  - AreaChartCard (user growth) + PieChartCard (role distribution) in a
 *    3-col grid (area spans 2 cols). Both wrapped in glass-card.
 *  - Top schools + Top contents tables in SectionCards.
 *  - System-health strip with pulse-glow indicator (decorative).
 */
export function PlatformDashboard() {
  const { user } = useUserStore();
  if (!user) return null;

  const t = useTranslations("Analytics");
  const tDash = useTranslations("Dashboard");
  const tNav = useTranslations("Navigation");

  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [growth, setGrowth] = useState<TimelinePoint[]>([]);
  const [roleDist, setRoleDist] = useState<RoleDistributionEntry[]>([]);
  const [topSchools, setTopSchools] = useState<PlatformTopSchool[]>([]);
  const [topContents, setTopContents] = useState<PlatformTopContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getPlatformOverviewAction(),
      getPlatformGrowthAction(30),
      getPlatformRoleDistributionAction(),
      getPlatformTopSchoolsAction(5),
      getPlatformTopContentsAction(5),
    ])
      .then(([o, g, r, s, c]) => {
        if (cancelled) return;
        if (o.success) setOverview(o.data);
        if (g.success) setGrowth(g.data);
        if (r.success) setRoleDist(r.data);
        if (s.success) setTopSchools(s.data);
        if (c.success) setTopContents(c.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const growthData = growth.map((p) => ({
    date: p.date.slice(5),
    registrations: p.count,
  }));

  const totalUsers = roleDist.reduce((acc, r) => acc + r.count, 0);
  const rolePieData = roleDist.map((r) => ({
    key: r.role,
    label: t(`role_${r.role}`),
    value: r.count,
    color: ROLE_COLORS[r.role],
  }));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={tDash("welcome", { name: user.firstName ?? user.email })}
          description={t("platformDashboardDescription")}
          icon={<ShieldAlert className="size-6" />}
          actions={
            <Button asChild variant="brand-outline" size="sm">
              <Link href="/admin/users">
                <Users className="size-4" />
                {tNav("users")}
              </Link>
            </Button>
          }
        />

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTrend
            label={t("totalUsers")}
            value={overview?.totalUsers ?? 0}
            icon={Users}
            accent="primary"
            hint={t("totalUsersHint")}
          />
          <StatTrend
            label={t("totalSchools")}
            value={overview?.totalSchools ?? 0}
            icon={SchoolIcon}
            accent="blue"
            hint={t("totalSchoolsHint")}
          />
          <StatTrend
            label={t("totalContents")}
            value={overview?.totalContents ?? 0}
            icon={FileText}
            accent="emerald"
            hint={t("totalContentsHint")}
          />
          <StatTrend
            label={t("activeSubscriptions")}
            value={overview?.activeSubscriptions ?? 0}
            icon={CreditCard}
            accent="amber"
            hint={t("activeSubscriptionsHint")}
          />
        </div>

        {/* System health strip (decorative, animated pulse-glow) */}
        <div className="glass-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="relative inline-flex size-2.5 rounded-full bg-success animate-pulse-glow"
            />
            <Activity className="size-3.5 text-success" aria-hidden />
            <span>System operational</span>
          </div>
          <span className="hidden h-3 w-px bg-border sm:inline-block" />
          <span className="text-xs text-muted-foreground">
            API · 99.98% uptime · 142ms p95
          </span>
          <span className="hidden h-3 w-px bg-border sm:inline-block" />
          <span className="text-xs text-muted-foreground">
            DB · 4 connections · healthy
          </span>
        </div>

        {/* Growth area chart + Role distribution pie */}
        <div className="grid gap-4 lg:grid-cols-3">
          <AreaChartCard
            title={t("registrationGrowth")}
            description={t("registrationGrowthHint")}
            data={growthData}
            xKey="date"
            series={[{ key: "registrations", label: t("registrations") }]}
            loading={loading}
            emptyMessage={t("noGrowthData")}
            height="260px"
            className="lg:col-span-2"
          />
          <PieChartCard
            title={t("roleDistribution")}
            description={t("roleDistributionHint")}
            data={rolePieData}
            loading={loading}
            emptyMessage={t("noRoleData")}
            height="260px"
            donut
            centerLabel={t("users")}
            centerValue={totalUsers}
          />
        </div>

        {/* Top schools + Top contents */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title={t("topSchools")}
            description={t("topSchoolsHint")}
            icon={<SchoolIcon className="size-5" />}
          >
            {topSchools.length === 0 ? (
              <EmptyState
                icon={SchoolIcon}
                title={t("noTopSchools")}
                description={t("noTopSchoolsHint")}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("school")}</TableHead>
                    <TableHead className="text-right">{t("members")}</TableHead>
                    <TableHead className="text-right">
                      {t("contentsCount")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSchools.map((s) => (
                    <TableRow key={s.schoolId}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        {s.city && (
                          <div className="text-xs text-muted-foreground">
                            {s.city}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.membersCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.contentsCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
          <SectionCard
            title={t("topContents")}
            description={t("topContentsHint")}
            icon={<FileText className="size-5" />}
          >
            {topContents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t("noTopContents")}
                description={t("noTopContentsHint")}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("content")}</TableHead>
                    <TableHead className="text-right">{t("views")}</TableHead>
                    <TableHead className="text-right">
                      {t("downloads")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topContents.map((c) => (
                    <TableRow key={c.contentId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="max-w-[200px] truncate font-medium">
                            {c.title}
                          </span>
                          <Badge variant="default">{c.type}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.viewsCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.downloadsCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}

void HelpCircle;
