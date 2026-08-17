import { SchoolDashboard } from "@/components/dashboard/school-dashboard";

/**
 * §5.3 + §5.9 — School admin dashboard.
 *
 * The <DashboardShell> is provided by <SchoolLayout> — this page just
 * renders the dashboard content.
 */
export default async function DashboardPage() {
  return <SchoolDashboard />;
}
