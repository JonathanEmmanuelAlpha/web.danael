import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { JoinRequestsManager } from "@/components/memberships/join-requests-manager";
import { listReceivedJoinRequestsAction } from "@/server/actions/memberships";
import { Inbox } from "lucide-react";
import type { JoinRequestItem } from "@/stores/notifications-store";
import type { UserRole } from "@/types";
import { getClassById } from "@/server/services/classes";
import { getTranslations } from "next-intl/server";

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("Classes");
  const { id } = await params;

  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;
  if (
    role !== "school_admin" &&
    role !== "teacher" &&
    role !== "platform_admin"
  ) {
    redirect("/dashboard");
  }

  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  // Get the school for this admin
  const targetClass = await getClassById(id);

  let requests: JoinRequestItem[] = [];
  if (targetClass) {
    const reqRes = await listReceivedJoinRequestsAction({
      targetType: "class",
      targetId: id,
    });
    if (reqRes.success && reqRes.data) {
      requests = reqRes.data.map((r) => ({
        id: r.id,
        type: "class" as const,
        refId: targetClass.id,
        refName: targetClass.name,
        role: r.role,
        message: r.message,
        status: r.status as JoinRequestItem["status"],
        requestedBy: {
          id: r.userId,
          name: r.userName,
          email: r.userEmail,
          avatarUrl: r.userAvatarUrl,
        },
        createdAt: r.createdAt.toISOString(),
      }));
    }
  }

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
      userEmail={user.email}
      user={toUserSessionData(user)}
      receivedJoinRequests={requests}
    >
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Inbox className="size-6 text-primary-600" />

            {targetClass ? (
              <div className="flex items-center gap-x-2.5">
                <span>{t("joinRequested")}</span>{" "}
                <span className="text-muted-foreground">|</span>
                <span className="text-primary-500">{targetClass?.name}</span>
              </div>
            ) : (
              <>{t("joinRequested")}</>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("joinRequestedDesc")}
          </p>
        </div>
        {targetClass ? (
          <JoinRequestsManager
            targetType="school"
            targetId={targetClass.id}
            targetName={targetClass.name}
            initialRequests={requests}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              <p className="text-sm text-muted-foreground">{t("noClass")}</p>
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
