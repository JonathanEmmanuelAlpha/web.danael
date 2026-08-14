import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { MessageSquare } from "lucide-react";
import { ThreadList } from "@/components/messaging/thread-list";
import { NewConversationDialog } from "@/components/messaging/new-conversation-dialog";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

/**
 * §5.11 — Main messaging page.
 *
 * Layout:
 *  - Mobile: just the thread list (click → /messages/[threadId])
 *  - Desktop (lg+): split view — list on the left, "select a conversation"
 *    placeholder on the right.
 *
 * The "New conversation" entry point is exposed in two places:
 *  - A prominent button in the PageHeader `actions` slot (page-level CTA).
 *  - A compact icon button in the ThreadList header (always-visible CTA).
 * Both render the same `<NewConversationDialog />` (role-aware multi-step flow).
 */
export default async function MessagesPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const tNav = await getTranslations("Navigation");
  const tMsg = await getTranslations("Messaging");
  const role = user.role as UserRole;
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell
      role={role}
      userName={userName}
      userImage={user.avatarUrl ?? undefined}
    >
      <div className="space-y-6">
        <PageHeader
          title={tNav("messages")}
          description={tMsg("subtitle")}
          icon={<MessageSquare className="size-6" />}
          actions={<NewConversationDialog />}
        />

        <div className="grid h-[calc(100vh-13rem)] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[360px_1fr]">
          {/* Thread list — visible on all viewports. */}
          <div className="border-r border-border lg:flex">
            <ThreadList />
          </div>

          {/* Placeholder — desktop only. */}
          <div className="hidden flex-col items-center justify-center p-8 text-center lg:flex">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600">
              <MessageSquare className="size-7" aria-hidden />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {tMsg("selectThread")}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {tMsg("selectThreadHint")}
            </p>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
