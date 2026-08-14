import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { SchoolDashboard } from "@/components/dashboard/school-dashboard";

/**
 * §5.10 — School analytics page.
 *
 * Phase 11: replaces the placeholder EmptyState with the analytics-rich
 * SchoolDashboard component (stat cards, engagement area chart, top contents,
 * class comparison, usage stats table).
 */
export default async function AnalyticsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "school_admin") redirect("/dashboard");

  return <SchoolDashboard />;
}
