import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { TutorProfileEditor } from "@/components/tutoring/tutor-profile-editor";
import { TutorAvailabilityEditor } from "@/components/tutoring/tutor-availability-editor";
import { getTutorProfileAction, getAvailabilityAction } from "@/server/actions/tutoring";
import { listSubjectsAction } from "@/server/actions/subjects";
import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

/**
 * §5.15 — Tutor profile editor page (bio, subjects, hourly rate, location, availability).
 */
export default async function TutorProfilePage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "tutor" && user.role !== "platform_admin") {
    redirect("/dashboard");
  }

  const t = await getTranslations("Tutoring");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  const [profileRes, subjectsRes, availRes] = await Promise.all([
    getTutorProfileAction(),
    listSubjectsAction(),
    (async () => {
      const p = await getTutorProfileAction();
      if (!p.success || !p.data) return { success: true as const, data: [] };
      const a = await getAvailabilityAction(p.data.id);
      return a;
    })(),
  ]);

  const profile = profileRes.success ? profileRes.data : null;
  const subjects = subjectsRes.success ? subjectsRes.data : [];
  const availabilities = availRes.success ? availRes.data : [];

  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          title={t("profile")}
          description={t("profileDescription")}
          icon={<Users className="size-6" />}
        />

        {!profile && (
          <EmptyState
            icon={Users}
            title={t("noProfile")}
            description={t("noProfileHint")}
          />
        )}

        <SectionCard title={t("editProfile")} icon={<Users className="size-5" />}>
          <TutorProfileEditor profile={profile} subjects={subjects} />
        </SectionCard>

        {profile && (
          <SectionCard
            title={t("availability")}
            description={t("availabilityHint")}
            icon={<Users className="size-5" />}
          >
            <TutorAvailabilityEditor
              profileId={profile.id}
              initial={availabilities}
            />
          </SectionCard>
        )}
      </div>
    </DashboardShell>
  );
}
