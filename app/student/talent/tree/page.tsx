import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { inArray } from "drizzle-orm";
import { GitBranch } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { getDb } from "@/server/db";
import { subjectSkills } from "@/server/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TalentTree,
  type TalentTreeNode,
} from "@/components/talent/talent-tree";

import { getTalentProfileAction } from "@/server/actions/talent";

/**
 * §10.4 — Talent Tree page (MVP).
 *
 * Builds a flat list of `TalentTreeNode`s from the student's detected
 * talent zones (no nested children for MVP). Fetches skill names via a
 * direct Drizzle query (the talent service does not return them).
 *
 * If the student has not yet taken the TDA, renders a CTA to take it.
 */
export default async function TalentTreePage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");

  const profileRes = await getTalentProfileAction();
  const profile = profileRes.success ? profileRes.data : null;

  /* ── No profile yet → CTA to take the assessment ────────────── */
  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={tNav("talentTree")}
          description={tNav("talentTreeDescription")}
          icon={<GitBranch className="size-6" />}
        />
        <EmptyState
          icon={GitBranch}
          title={tNav("assessmentTitle")}
          description={tNav("assessmentDescription")}
          action={{
            label: tNav("assessmentTitle"),
            href: "/student/talent/assessment",
          }}
        />
      </div>
    );
  }

  /* ── Build nodes from zones (MVP: flat list, no children) ─────── */
  let nodes: TalentTreeNode[] = [];

  if (profile.zones.length > 0) {
    const skillIds = profile.zones.map((z) => z.skillId);

    // Fetch the skill names for each zone.
    const db = await getDb();
    const skillRows = await db
      .select({
        id: subjectSkills.id,
        name: subjectSkills.name,
      })
      .from(subjectSkills)
      .where(inArray(subjectSkills.id, skillIds));

    const skillNameById = new Map(skillRows.map((s) => [s.id, s.name]));

    nodes = profile.zones.map((zone) => ({
      id: zone.skillId,
      name: skillNameById.get(zone.skillId) ?? zone.skillId,
      description: `${zone.zoneType} · confidence ${Math.round(
        zone.confidence * 100,
      )}%`,
      tier: zone.tier,
      talentScore: zone.talentScore,
      mastery: Math.round(zone.talentScore * 100),
      isUnlocked: zone.tier !== "seedling" || zone.zoneType === "north_star",
      isNorthStar: zone.zoneType === "north_star",
      children: [],
    }));

    // Sort: North Star first, then talents, then growth zones.
    const zoneOrder: Record<string, number> = {
      north_star: 0,
      talent: 1,
      growth: 2,
    };
    nodes.sort((a, b) => {
      const zoneA = profile.zones.find((z) => z.skillId === a.id);
      const zoneB = profile.zones.find((z) => z.skillId === b.id);
      return (
        (zoneOrder[zoneA?.zoneType ?? ""] ?? 99) -
        (zoneOrder[zoneB?.zoneType ?? ""] ?? 99)
      );
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("talentTree")}
        description={tNav("talentTreeDescription")}
        icon={<GitBranch className="size-6" />}
      />

      {nodes.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={tNav("talentTree")}
          description={tNav("talentTreeDescription")}
        />
      ) : (
        <TalentTree nodes={nodes} />
      )}
    </div>
  );
}
