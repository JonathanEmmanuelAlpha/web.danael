import { StudentDashboard } from "@/components/dashboard/student-dashboard";

/**
 * §5.3 + §5.9 — Student dashboard.
 *
 * The <DashboardShell> is provided by <StudentLayout> — this page just
 * renders the dashboard content.
 */
export default async function DashboardPage() {
  return <StudentDashboard />;
}
