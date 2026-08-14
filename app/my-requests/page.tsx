import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MyJoinRequestsList } from "@/components/memberships/my-join-requests-list";
import { listMyJoinRequestsAction } from "@/server/actions/memberships";
import { Send } from "lucide-react";
import type { JoinRequestItem } from "@/stores/notifications-store";
import type { UserRole } from "@/types";

export default async function MyRequestsPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  const requestsRes = await listMyJoinRequestsAction();
  const myRequests: JoinRequestItem[] =
    requestsRes.success && requestsRes.data
      ? requestsRes.data.map((r) => ({
          id: r.id,
          type: r.type,
          refId: r.refId,
          refName: r.refName,
          role: r.role,
          message: r.message,
          status: r.status as JoinRequestItem["status"],
          requestedBy: {
            id: user.id,
            name: userName ?? user.email,
            email: user.email,
            avatarUrl: user.avatarUrl,
          },
          createdAt: r.createdAt.toISOString(),
          decidedAt: r.decidedAt?.toISOString(),
        }))
      : [];

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
      userEmail={user.email}
      user={toUserSessionData(user)}
    >
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Send className="size-6 text-primary-600" />
            Mes demandes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivez le statut de vos demandes d'adhésion aux écoles et classes.
          </p>
        </div>
        <MyJoinRequestsList requests={myRequests} />
      </div>
    </DashboardShell>
  );
}
