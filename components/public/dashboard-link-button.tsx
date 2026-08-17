import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentDbUser } from "@/lib/clerk";
import { getUserDashboardRoadByRole } from "@/lib/utils";
import type { UserRole } from "@/types";

/**
 * Server-side "Dashboard" button for the public header.
 *
 * On public pages, the Zustand user store is NOT hydrated with the server
 * user (we only hydrate it inside <DashboardShell>). So the public header
 * can't read the user's role from the store to compute the dashboard link.
 *
 * This component fetches the user server-side and renders the correct
 * dashboard link. If the user is not signed in or hasn't completed
 * onboarding, it renders null (the parent <PublicHeader /> handles the
 * signed-out state via Clerk's useUser()).
 *
 * Usage (inside a server component):
 *   <PublicHeaderSlot />
 *
 * The <PublicHeader /> client component checks `isSignedIn` from Clerk's
 * useUser() hook. When signed in, it renders this server-side link instead
 * of trying to compute the dashboard URL from the (empty) Zustand store.
 */
export async function DashboardLinkButton({
  variant = "brand",
  size = "sm",
  label,
}: {
  variant?: "brand" | "brand-outline" | "outline" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  label: string;
}) {
  const user = await getCurrentDbUser();

  // Not signed in or no DB row yet → link to /sign-in (Clerk will handle).
  if (!user) {
    return (
      <Button asChild variant={variant} size={size}>
        <Link href="/sign-in">{label}</Link>
      </Button>
    );
  }

  // Onboarding not complete → link to onboarding.
  if (user.onboardingStatus !== "completed") {
    return (
      <Button asChild variant={variant} size={size}>
        <Link href="/onboarding/role">{label}</Link>
      </Button>
    );
  }

  const role = user.role as UserRole;
  const href = getUserDashboardRoadByRole(role);

  return (
    <Button asChild variant={variant} size={size}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}
