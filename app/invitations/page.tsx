import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InvitationsList } from "@/components/memberships/invitations-list";
import { listMyInvitationsAction } from "@/server/actions/memberships";
import { Mail } from "lucide-react";
import type { InvitationItem } from "@/stores/notifications-store";

export default async function InvitationsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  // Fetch invitations on the server
  const invitationsRes = await listMyInvitationsAction();
  const invitations: InvitationItem[] =
    invitationsRes.success && invitationsRes.data
      ? invitationsRes.data.map((inv) => ({
          id: inv.id,
          type: inv.targetType as "school" | "class",
          refId: inv.targetId,
          refName: inv.targetName,
          refPicture: null,
          role: inv.roleInTarget,
          message: inv.message,
          status: inv.status as InvitationItem["status"],
          invitedBy: {
            id: "",
            name: inv.invitedByName,
            avatarUrl: inv.invitedByAvatarUrl,
          },
          createdAt: inv.createdAt.toISOString(),
          expiresAt: inv.expiresAt?.toISOString(),
        }))
      : [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Mail className="size-6 text-primary-600" />
            Mes invitations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les invitations que vous avez reçues pour rejoindre des écoles et
            classes.
          </p>
        </div>
        <InvitationsList invitations={invitations} />
      </div>
    </DashboardShell>
  );
}
