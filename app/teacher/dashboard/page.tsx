import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";

/**
 * §5.3 + §5.9 — Teacher dashboard.
 *
 * The <DashboardShell> is provided by <TeacherLayout> — this page just
 * renders the dashboard content.
 */
export default async function DashboardPage() {
  return <TeacherDashboard />;
}
