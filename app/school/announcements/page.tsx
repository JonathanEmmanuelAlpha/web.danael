import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { AnnouncementCard } from "@/components/messaging/announcement-card";
import { CreateAnnouncementDialog } from "@/components/messaging/create-announcement-dialog";
import { AnnouncementsList } from "@/components/messaging/announcements-list";
import { Megaphone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";
import { AppError } from "@/lib/api-response";
import { getMySchoolAction, listManagedAnnouncementsAction } from "@/server/actions/schools";
import { listAnnouncementsAction } from "@/server/actions/messaging";

/**
 * §5.11 — School admin announcements page.
 *
 * - school_admin → manage announcements (list + create + delete)
 * - teachers → create announcements (visible to themselves + their classes)
 * - students/parents → view announcements visible to them (read-only)
 */
export default async function AnnouncementsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const tNav = await getTranslations("Navigation");
  const tMsg = await getTranslations("Messaging");
  const role = user.role as UserRole;
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  const canManage =
    role === "school_admin" || role === "teacher" || role === "platform_admin";

  // school_admin: try to resolve their school to scope announcements.
  let schoolId: string | undefined;
  if (role === "school_admin") {
    const schoolRes = await getMySchoolAction();
    if (schoolRes.success) {
      schoolId = schoolRes.data.id;
    }
  }

  // Fetch announcements: managed (for school_admin/teacher) OR visible to the user.
  let announcements: Awaited<
    ReturnType<typeof listAnnouncementsAction>
  >["data"] = { items: [], total: 0, page: 1, pageSize: 20 };
  if (canManage && (role === "school_admin" || role === "teacher")) {
    const res = await listManagedAnnouncementsAction({ pageSize: 50 });
    if (res.success) announcements = res.data;
  } else {
    const res = await listAnnouncementsAction({ pageSize: 50 });
    if (res.success) announcements = res.data;
  }

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <div className="space-y-6">
        <PageHeader
          title={tMsg("announcements")}
          description={tMsg("announcementsSubtitle")}
          icon={<Megaphone className="size-6" />}
          actions={
            canManage ? (
              <CreateAnnouncementDialog schoolId={schoolId} />
            ) : undefined
          }
        />

        <AnnouncementsList
          initialItems={announcements.items}
          canManage={canManage}
        />
      </div>
    </DashboardShell>
  );
}

/* Re-export to keep AppError reachable for type bundlers. */
void AppError;
