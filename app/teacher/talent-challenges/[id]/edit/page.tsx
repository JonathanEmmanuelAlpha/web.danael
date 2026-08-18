import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { TalentChallengeForm } from "@/components/talent/talent-challenge-form";
import { getTalentChallengeAction } from "@/server/actions/talent";
import { listSubjectsAction } from "@/server/actions/subjects";
import type { Subject } from "@/server/db/schema/schools";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["teacher", "platform_admin"] as const;

/**
 * §10.4 — Edit an existing talent challenge (teacher / platform_admin).
 *
 * Pre-fills the form with the current challenge values. The actual
 * update action (`updateTalentChallengeAction`) is not wired up yet —
 * the form will render an "update not available" banner and disable the
 * submit button when in edit mode.
 */
export default async function EditTalentChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  // Note: /teacher/layout.tsx already restricts access to the "teacher"
  // role. We keep this defensive allow-list check for the roles called
  // out by the task spec.
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
    redirect("/teacher/dashboard");
  }

  const { id } = await params;
  const tTalent = await getTranslations("Talent");

  const challengeRes = await getTalentChallengeAction(id);
  if (!challengeRes.success || !challengeRes.data) {
    if (challengeRes.success === false && challengeRes.error?.code === "NOT_FOUND") {
      notFound();
    }
    throw new Error(tTalent("challengeLoadFailed"));
  }
  const challenge = challengeRes.data;

  // Only the creator (or a platform_admin) can edit.
  // `createdBy` is a non-null uuid column on `talent_challenges`.
  if (
    challenge.createdBy !== user.id &&
    user.role !== "platform_admin"
  ) {
    redirect("/teacher/talent-challenges");
  }

  const subjectsRes = await listSubjectsAction();
  const subjects: Subject[] = subjectsRes.success ? subjectsRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tTalent("editChallenge")}
        description={tTalent("editChallengeDescription")}
        icon={<Pencil className="size-6" />}
      />
      <div className="mx-auto max-w-3xl">
        <TalentChallengeForm subjects={subjects} initialChallenge={challenge} />
      </div>
    </div>
  );
}
