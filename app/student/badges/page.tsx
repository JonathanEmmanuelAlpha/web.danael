import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Award } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { BadgeGrid } from "@/components/gamification/badge-grid";
import type { UserRole } from "@/types";

/**
 * §5.8 — Badge collection page.
 *
 * Shows all badges (earned + locked). Earned badges appear first, sorted by
 * earnedAt desc, then by category.
 */
export default async function BadgesPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  if (role !== "student" && role !== "tutor" && role !== "teacher") {
    redirect("/dashboard");
  }

  const tBadge = await getTranslations("Gamification");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={tBadge("badges")}
          description={tBadge("badgesDescription")}
          icon={<Award className="size-6" />}
        />
        <SectionCard
          title={tBadge("collection")}
          description={tBadge("collectionHint")}
        >
          <BadgeGrid userId={user.id} />
        </SectionCard>
      </div>
    </>
  );
}
