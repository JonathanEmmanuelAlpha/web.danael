import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";

/**
 * §5.10 — Teacher analytics page.
 *
 * Phase 11: dedicated teacher analytics view at /teacher-analytics
 * (since /dashboard already serves all roles from (school)/dashboard).
 */
export default async function TeacherAnalyticsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "teacher") redirect("/dashboard");

  return <TeacherDashboard />;
}
