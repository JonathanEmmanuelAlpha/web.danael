import { PlatformDashboard } from "@/components/dashboard/platform-dashboard";

/**
 * §5.10 — Platform analytics page.
 *
 * Phase 11: replaces the placeholder EmptyState with the analytics-rich
 * PlatformDashboard component (growth chart, role pie, top schools/contents).
 */
export default async function AdminAnalyticsPage() {
  return <PlatformDashboard />;
}
