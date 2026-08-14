import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { NotificationList } from "@/components/notifications/notification-list";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * §5.12 — Notifications page.
 *
 * - Full notifications list with filter tabs (all / unread) + type filter
 * - Preferences form (channels, categories, quiet hours, frequency)
 */
export default async function NotificationsPage() {
  const tNav = await getTranslations("Navigation");
  const tNotif = await getTranslations("Notifications");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={tNav("notifications")}
          description={tNotif("subtitle")}
          icon={<Bell className="size-6" />}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <SectionCard
            title={tNotif("list")}
            description={tNotif("listHint")}
            icon={<Bell className="size-4" />}
            contentClassName="space-y-4"
          >
            <NotificationList />
          </SectionCard>

          <SectionCard
            title={tNotif("preferences")}
            description={tNotif("preferencesHint")}
            icon={<Bell className="size-4" />}
          >
            <NotificationPreferences />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
