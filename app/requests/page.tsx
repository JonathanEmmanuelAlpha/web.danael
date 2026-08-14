import { redirect } from "next/navigation";
import { getCurrentDbUser, toUserSessionData } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { JoinRequestsManager } from "@/components/memberships/join-requests-manager";
import { getMySchoolAction } from "@/server/actions/schools";
import { listReceivedJoinRequestsAction } from "@/server/actions/memberships";
import { Inbox } from "lucide-react";
import type { JoinRequestItem } from "@/stores/notifications-store";
import type { UserRole } from "@/types";
import { getTranslations } from "next-intl/server";

export default async function RequestsPage() {
  const t = await getTranslations("Schools");

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
  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  let requests: JoinRequestItem[] = [];
  if (school) {
    const reqRes = await listReceivedJoinRequestsAction({
      targetType: "school",
      targetId: school.id,
    });
    if (reqRes.success && reqRes.data) {
      requests = reqRes.data.map((r) => ({
        id: r.id,
        type: "school" as const,
        refId: school.id,
        refName: school.name,
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
            {school ? (
              <div className="flex items-center gap-x-2.5">
                <span>{t("joinRequested")}</span>{" "}
                <span className="text-muted-foreground">|</span>
                <span className="text-primary-500">{school?.name}</span>
              </div>
            ) : (
              <>{t("joinRequested")}</>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("joinRequestedDesc")}
          </p>
        </div>
        {school ? (
          <JoinRequestsManager
            targetType="school"
            targetId={school.id}
            targetName={school.name}
            initialRequests={requests}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("noSchool")}</p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
