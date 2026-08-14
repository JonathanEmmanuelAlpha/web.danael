import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { CompetitionForm } from "@/components/gamification/competition-form";
import type { UserRole } from "@/types";

/**
 * §5.7 — Create competition form page (teacher / school_admin / platform_admin).
 */
export default async function NewCompetitionPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  if (role !== "teacher" && role !== "school_admin" && role !== "platform_admin") {
    redirect("/dashboard");
  }

  const tComp = await getTranslations("Competitions");
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={tComp("newCompetition")}
          description={tComp("newCompetitionHint")}
          icon={<Trophy className="size-6" />}
        />
        <CompetitionForm />
      </div>
    </DashboardShell>
  );
}
