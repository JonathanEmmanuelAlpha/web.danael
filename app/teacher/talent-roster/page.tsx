import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Users, Clock } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";

export const dynamic = "force-dynamic";

/**
 * §10.4 — Talent roster per class (teacher view).
 *
 * Placeholder page — the per-class talent aggregation requires complex
 * cross-cohort queries that are not yet exposed in the talent services.
 *
 * TODO(real implementation):
 *   1. Fetch the list of classes the current teacher owns / co-teaches
 *      (class_members where userId = current and role = "teacher").
 *   2. For each class, fetch:
 *      - The detected talent zones of every enrolled student
 *        (join users ⨝ talent_profiles ⨝ student_talent_zones).
 *      - The North Star skill chosen by each student
 *        (talent_profiles.northStarSkillId).
 *      - The active foundation alerts for the class (floor_alerts where
 *        status = "open" and studentId ∈ class_members).
 *      - The weekly talent track progress
 *        (talent_tracks ⨝ talent_track_progress).
 *   3. Group by class and render a SectionCard per class, with a
 *      TalentChallengeCard-style mini grid inside, showing each student's
 *      North Star badge + tier + floor alert count.
 *   4. Add filtering by level / series / skill.
 */
export default async function TeacherTalentRosterPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");
  if (user.role !== "teacher") redirect("/teacher/dashboard");

  const tNav = await getTranslations("Navigation");
  const tTalent = await getTranslations("Talent");

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("talentRoster")}
        icon={<Users className="size-6" />}
      />

      <SectionCard
        title={tTalent("rosterComingSoonTitle")}
        icon={<Clock className="size-4" />}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tTalent("rosterComingSoonDescription")}
        </p>
      </SectionCard>
    </div>
  );
}
