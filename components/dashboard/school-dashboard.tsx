"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  PlusCircle,
  School as SchoolIcon,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTrend } from "@/components/charts/stat-trend";
import { AreaChartCard } from "@/components/charts/area-chart";
import { BarChartCard } from "@/components/charts/bar-chart";
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
  getSchoolClassComparisonAction,
  getSchoolEngagementAction,
  getSchoolOverviewAction,
  getSchoolTopContentsAction,
  getSchoolUsageStatsAction,
} from "@/server/actions/analytics";
import { getMySchoolAction } from "@/server/actions/schools";
import type {
  SchoolOverview,
  SchoolTopContent,
  SchoolUsageStat,
  TeacherClassStat,
  TimelinePoint,
} from "@/server/services/analytics";
import { PageLoader } from "@/components/shared/loading";
import { CreateSchoolForm } from "@/components/schools/create-school-form";
import { useUserStore } from "@/stores/user-store";

/**
 * §5.9 — School admin dashboard with rich analytics charts.
 *
 * If the user has no school yet, shows the create-school form.
 * Otherwise fetches school analytics and renders overview cards + charts.
 *
 * Aurora Navy refonte:
 *  - PageHeader with brand-outline + brand quick actions (invite / contents).
 *  - StatTrend cards in 4-col grid (already refactored).
 *  - AreaChartCard for engagement, BarChartCard for class comparison — both
 *    wrapped in glass-card via ChartContainer.
 *  - Top contents list rendered as numbered glass rows with staggered
 *    `animate-fade-up`.
 *  - Usage stats in a SectionCard table.
 */
export function SchoolDashboard() {
  const user = useUserStore((s) => s.user);

  const t = useTranslations("Analytics");
  const tSchool = useTranslations("Schools");
  const tDash = useTranslations("Dashboard");
  const tNav = useTranslations("Navigation");
  const router = useRouter();

  const [schoolId, setSchoolId] = useState<string | null | undefined>(
    undefined,
  );

  const [overview, setOverview] = useState<SchoolOverview | null>(null);
  const [engagement, setEngagement] = useState<TimelinePoint[]>([]);
  const [topContents, setTopContents] = useState<SchoolTopContent[]>([]);
  const [classComparison, setClassComparison] = useState<TeacherClassStat[]>(
    [],
  );
  const [usage, setUsage] = useState<SchoolUsageStat | null>(null);
  const [fetchStarted, setFetchStarted] = useState(false);

  // First resolve the school for the current admin user.
  useEffect(() => {
    let cancelled = false;
    getMySchoolAction().then((res) => {
      if (cancelled) return;
      if (res.success) setSchoolId(res.data?.id ?? null);
      else {
        toast.error(res.error?.message ?? tSchool("noSchool"));
        setSchoolId(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tSchool]);

  // Once we have a schoolId, fetch analytics. Skip when undefined or null.
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    Promise.all([
      getSchoolOverviewAction(schoolId),
      getSchoolEngagementAction(schoolId, 30),
      getSchoolTopContentsAction(schoolId, 5),
      getSchoolClassComparisonAction(schoolId),
      getSchoolUsageStatsAction(schoolId),
    ])
      .then(([o, e, tc, cc, u]) => {
        if (cancelled) return;
        if (o.success) setOverview(o.data);
        if (e.success) setEngagement(e.data);
        if (tc.success) setTopContents(tc.data);
        if (cc.success) setClassComparison(cc.data);
        if (u.success) setUsage(u.data);
      })
      .finally(() => {
        if (!cancelled) setFetchStarted(true);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  if (schoolId === undefined) {
    return (
      <>
        <PageLoader />
      </>
    );
  }

  if (!schoolId) {
    return (
      <>
        <CreateSchoolForm
          onCreated={() => {
            router.push("/dashboard");
            router.refresh();
          }}
        />
      </>
    );
  }

  // Loading state is true until the analytics fetch resolves at least once.
  const loading = !fetchStarted || overview === null;

  const engagementData = engagement.map((p) => ({
    date: p.date.slice(5),
    activeUsers: p.count,
  }));

  const classComparisonData = classComparison.map((c) => ({
    name: c.className,
    score: c.averageScore,
    completion: c.completionRate,
  }));

  if (!user) return null;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={tDash("welcome", { name: user.firstName ?? user.email })}
          description={t("schoolDashboardDescription")}
          icon={<BarChart3 className="size-6" />}
          actions={
            <>
              <Button asChild variant="brand-outline" size="sm">
                <Link href="/students">
                  <UserPlus className="size-4" />
                  {tNav("students")}
                </Link>
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link href="/classes">
                  <PlusCircle className="size-4" />
                  {tNav("classes")}
                </Link>
              </Button>
            </>
          }
        />

        {/* Stat cards row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTrend
            label={t("teachersCount")}
            value={overview?.teachersCount ?? 0}
            icon={GraduationCap}
            accent="primary"
          />
          <StatTrend
            label={t("studentsCount")}
            value={overview?.studentsCount ?? 0}
            icon={Users}
            accent="emerald"
          />
          <StatTrend
            label={t("classesCount")}
            value={overview?.classesCount ?? 0}
            icon={SchoolIcon}
            accent="amber"
          />
          <StatTrend
            label={t("contentsCount")}
            value={overview?.contentsCount ?? 0}
            icon={BookOpen}
            accent="blue"
          />
        </div>

        {/* Engagement area chart */}
        <AreaChartCard
          title={t("activeUsersOverTime")}
          description={t("activeUsersOverTimeHint")}
          data={engagementData}
          xKey="date"
          series={[{ key: "activeUsers", label: t("activeUsers") }]}
          loading={loading}
          emptyMessage={t("noEngagementData")}
          height="260px"
        />

        {/* Class comparison + Top contents */}
        <div className="grid gap-4 lg:grid-cols-2">
          <BarChartCard
            title={t("classComparison")}
            description={t("classComparisonHint")}
            data={classComparisonData}
            xKey="name"
            series={[
              { key: "score", label: t("avgScore"), color: "#93d91a" },
              { key: "completion", label: t("completion"), color: "#fbbf24" },
            ]}
            loading={loading}
            emptyMessage={t("noClassData")}
            height="260px"
          />
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
              <ul className="space-y-2">
                {topContents.map((c, i) => (
                  <li
                    key={c.contentId}
                    className="animate-fade-up flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2 transition-colors hover:bg-white/[0.04]"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-xs font-semibold text-primary-400 ring-1 ring-inset ring-primary-500/20">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("viewsCount", { count: c.viewsCount })} ·{" "}
                        {t("downloadsCount", { count: c.downloadsCount })}
                      </p>
                    </div>
                    <Badge variant="default">{c.type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Usage stats table */}
        <SectionCard
          title={t("usageStats")}
          description={t("usageStatsHint")}
          icon={<TrendingUp className="size-5" />}
        >
          {usage ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("metric")}</TableHead>
                  <TableHead className="text-right">{t("value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    {t("assignmentsCreated")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {usage.assignmentsCreated}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    {t("submissions")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {usage.submissionsCount}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    {t("quizSessions")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {usage.quizSessionsCount}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    {t("contentsPublished")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {usage.contentsPublished}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="glass-card rounded-lg p-6 text-center text-sm text-muted-foreground">
              {t("noUsageStats")}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

void ClipboardList;
void HelpCircle;
