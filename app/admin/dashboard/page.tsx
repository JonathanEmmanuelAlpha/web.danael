import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  Users,
  School as SchoolIcon,
  FolderOpen,
  ShieldAlert,
  CreditCard,
  DollarSign,
  ClipboardList,
  Flag,
  ArrowRight,
  LayoutDashboard,
  BookOpen,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { PlatformStatsCards } from "@/components/admin/platform-stats";
import { ModerationQueue } from "@/components/admin/moderation-queue";
import { Card } from "@/components/ui/card";

/**
 * §5.16 — Platform admin dashboard.
 *
 * Rendered inside <AdminLayout> which already provides <DashboardShell>.
 * This page just renders the dashboard content (header, KPIs, moderation
 * queue, quick-link tiles).
 */
export default async function AdminDashboardPage() {
  const t = await getTranslations("Admin");

  const modules = [
    {
      href: "/admin/users",
      icon: Users,
      title: t("users"),
      description: t("usersHint"),
    },
    {
      href: "/admin/schools",
      icon: SchoolIcon,
      title: t("schools"),
      description: t("schoolsHint"),
    },
    {
      href: "/admin/subjects",
      icon: BookOpen,
      title: t("subjects"),
      description: t("subjectsHint"),
    },
    {
      href: "/admin/contents",
      icon: FolderOpen,
      title: t("contents"),
      description: t("contentsHint"),
    },
    {
      href: "/admin/moderation",
      icon: ShieldAlert,
      title: t("moderation"),
      description: t("moderationHint"),
    },
    {
      href: "/admin/subscriptions",
      icon: CreditCard,
      title: t("subscriptions"),
      description: t("subscriptionsHint"),
    },
    {
      href: "/admin/payments",
      icon: DollarSign,
      title: t("payments"),
      description: t("paymentsHint"),
    },
    {
      href: "/admin/audit",
      icon: ClipboardList,
      title: t("audit"),
      description: t("auditHint"),
    },
    {
      href: "/admin/feature-flags",
      icon: Flag,
      title: t("featureFlags"),
      description: t("featureFlagsHint"),
    },
    {
      href: "/admin/analytics",
      icon: LayoutDashboard,
      title: t("analytics"),
      description: t("analyticsHint"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboardTitle")}
        description={t("dashboardDescription")}
        icon={<LayoutDashboard className="size-6" />}
      />

      {/* Platform KPI stat cards */}
      <PlatformStatsCards />

      {/* Moderation queue quick-glance */}
      <ModerationQueue />

      {/* Quick links to all modules */}
      <SectionCard
        title={t("modules")}
        description={t("modulesHint")}
        icon={<ArrowRight className="size-4" />}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
                <Card className="group flex items-start gap-3 p-4 transition-colors hover:bg-muted/40">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.description}
                    </p>
                  </div>
                  <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Card>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
