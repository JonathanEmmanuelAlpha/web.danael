import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { CreateSchoolForm } from "@/components/schools/create-school-form";
import { SchoolSettingsForm } from "@/components/schools/school-settings-form";
import { getMySchoolAction } from "@/server/actions/schools";
import { Settings as SettingsIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

/**
 * §5.3 — School settings page (school_admin only).
 *
 * - school_admin with no school → create-school form
 * - school_admin with a school → school-settings form
 * - other roles → simple placeholder settings card (Phase 5 will expand)
 */
export default async function SettingsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const t = await getTranslations("Schools");
  const tNav = await getTranslations("Navigation");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  // Non-school_admin → simple placeholder.
  if (role !== "school_admin" && role !== "platform_admin") {
    return (
      <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
        <PageHeader
          title={tNav("settings")}
          description={t("comingSoon")}
          icon={<SettingsIcon className="size-6" />}
        />
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {t("comingSoonHint")}
          </p>
        </div>
      </DashboardShell>
    );
  }

  // school_admin path.
  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  if (!school) {
    return (
      <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
        <div className="mx-auto max-w-2xl">
          <PageHeader
            title={tNav("settings")}
            description={t("createSchoolDescription")}
            icon={<SettingsIcon className="size-6" />}
          />
          <CreateSchoolForm />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title={t("schoolSettings")}
          description={t("schoolSettingsDescription")}
          icon={<SettingsIcon className="size-6" />}
        />
        <SchoolSettingsForm school={school} />
      </div>
    </DashboardShell>
  );
}
