import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

/**
 * §5.5 — Create new assignment page (teacher).
 *
 * Wraps the AssignmentForm component in a SectionCard to match the rest of
 * the dashboard styling.
 */
export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  if (user.role !== "teacher" && user.role !== "school_admin" && user.role !== "platform_admin") {
    redirect("/dashboard");
  }

  const { classId } = await searchParams;
  const t = await getTranslations("Assignments");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          title={t("new")}
          description={t("noAssignmentsHint")}
          icon={<ClipboardList className="size-6" />}
        />
        <SectionCard title={t("new")} description={t("itemsHint")}>
          <AssignmentForm defaultClassId={classId} />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
