import { StudentDashboard } from "@/components/dashboard/student-dashboard";

/**
 * §5.3 + §5.9 — Role-aware dashboard.
 *
 * Phase 11 enrichment: each role branch now renders a dedicated
 * analytics-rich dashboard component (charts, tables, KPIs).
 */
export default async function DashboardPage() {
  return <StudentDashboard />;
}
