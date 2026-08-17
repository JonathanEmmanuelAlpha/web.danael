import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShellServer } from "@/components/layout/dashboard-shell-server";
import { ThreadList } from "@/components/messaging/thread-list";
import { ThreadView } from "@/components/messaging/thread-view";

/**
 * §5.11 — Specific thread view.
 *
 * Layout:
 *  - Mobile: just the ThreadView (with a back button)
 *  - Desktop (lg+): split view — list on the left (with active highlight),
 *    thread view on the right.
 */
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");
  const { threadId } = await params;

  return (
    <DashboardShellServer user={user}>
      <div className="grid h-[calc(100vh-9rem)] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[360px_1fr]">
        {/* List — desktop only. */}
        <div className="hidden border-r border-border lg:flex">
          <ThreadList activeThreadId={threadId} />
        </div>

        {/* Thread view — visible on all viewports. */}
        <div className="flex min-h-0 flex-col">
          <ThreadView
            threadId={threadId}
            currentUserId={user.id}
            showBackButton
          />
        </div>
      </div>
    </DashboardShellServer>
  );
}
