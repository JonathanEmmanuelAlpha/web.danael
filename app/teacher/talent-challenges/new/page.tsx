import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { TalentChallengeForm } from "@/components/talent/talent-challenge-form";
import { listSubjectsAction } from "@/server/actions/subjects";
import type { Subject } from "@/server/db/schema/schools";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["teacher", "platform_admin"] as const;

/**
 * §10.4 — Create a new talent challenge (teacher / platform_admin).
 */
export default async function NewTalentChallengePage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  // Note: /teacher/layout.tsx already restricts access to the "teacher"
  // role. We keep this defensive allow-list check for the roles called
  // out by the task spec.
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    redirect("/teacher/dashboard");
  }

  const tTalent = await getTranslations("Talent");

  const subjectsRes = await listSubjectsAction();
  const subjects: Subject[] = subjectsRes.success ? subjectsRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tTalent("newChallenge")}
        description={tTalent("newChallengeDescription")}
        icon={<Plus className="size-6" />}
      />
      <div className="mx-auto max-w-3xl">
        <TalentChallengeForm subjects={subjects} />
      </div>
    </div>
  );
}
