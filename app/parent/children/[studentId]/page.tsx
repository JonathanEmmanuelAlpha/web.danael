import { notFound, redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ChildDetailView } from "@/components/parent/child-detail-view";
import { isParentOf } from "@/server/permissions";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

/**
 * §5.14 — Parent view of a single child.
 *
 * Verifies the current user is linked to the student (parent_student_relations)
 * before rendering the rich overview.
 */
export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "parent" && user.role !== "platform_admin") {
    redirect("/dashboard");
  }

  const { studentId } = await params;

  // Verify the student exists & has role "student".
  const db = await getDb();
  const studentRows = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  const student = studentRows.at(0);
  if (!student || student.role !== "student") {
    notFound();
  }

  // Verify the parent is linked.
  if (user.role === "parent") {
    const linked = await isParentOf(user.id, studentId);
    if (!linked) {
      notFound();
    }
  }

  const t = await getTranslations("Parent");

  return (
    <DashboardShell>
      <ChildDetailView studentId={studentId} />
      <p className="sr-only">{t("childOverview")}</p>
    </DashboardShell>
  );
}
