"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetHeader,
} from "@/components/ui/sheet";
import { StoreHydrator } from "@/components/providers/store-hydrator";
import type { UserRole } from "@/types";
import { useUserStore, type UserSessionData } from "@/stores/user-store";
import type {
  SchoolContextData,
  ClassContextData,
} from "@/stores/school-store";
import type {
  NotificationItem,
  InvitationItem,
  JoinRequestItem,
} from "@/stores/notifications-store";
import { cn } from "@/lib/utils";
import { Skeleton } from "../shared/loading";

export interface DashboardShellProps {
  school?: SchoolContextData | null;
  classes?: ClassContextData[];
  notifications?: NotificationItem[];
  invitations?: InvitationItem[];
  myJoinRequests?: JoinRequestItem[];
  receivedJoinRequests?: JoinRequestItem[];
  children: ReactNode;
}

/**
 * Full dashboard chrome: sidebar (desktop) + mobile sheet + topbar + content.
 *
 * HYDRATION: When `user` prop is provided, the StoreHydrator pushes it into
 * the Zustand user store on mount. Topbar & Sidebar then read from the store
 * instead of calling useUser() / Clerk API on every render.
 *
 * Refonte "Aurora Navy":
 *  - root container decorated with subtle decorative halos (lime + violet)
 *  - main content area layered over a soft dot-grid + aurora background
 *  - mobile sidebar uses glass-strong for a consistent glassmorphic look
 *  - StoreHydrator remains the single hydration entry point
 */
export function DashboardShell({
  school,
  classes,
  notifications,
  invitations,
  myJoinRequests,
  receivedJoinRequests,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLoading, user } = useUserStore();

  if (isLoading || !user) return <Skeleton />;

  if (!isLoading && !user) return null;

  const role = user.role as UserRole;
  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <div className="relative flex min-h-screen bg-background">
      {/* ── Decorative background halos ────────────────────────────── */}
      <div
        aria-hidden
        className="halo-lime pointer-events-none absolute -left-40 top-0 size-112 opacity-50 z-100"
      />
      <div
        aria-hidden
        className="halo-violet pointer-events-none absolute -right-0 top-1/3 size-128 opacity-50 z-100"
      />
      <div
        aria-hidden
        className="halo-amber pointer-events-none absolute bottom-0 left-1/4 size-96 opacity-50 z-100"
      />

      {/* Hydrate Zustand stores from server-fetched data */}
      {user && (
        <StoreHydrator
          user={user}
          school={school ?? null}
          classes={classes}
          notifications={notifications}
          invitations={invitations}
          myJoinRequests={myJoinRequests}
          receivedJoinRequests={receivedJoinRequests}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="relative z-20 hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 min-h-screen">
          <Sidebar role={role} />
        </div>
      </aside>

      {/* Mobile sidebar (sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className={cn(
            "glass-strong w-72 border-r border-border-strong p-0",
            "data-[state=open]:animate-slide-up data-[state=closed]:duration-300 data-[state=open]:duration-500",
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar
            role={role}
            variant="mobile"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar
          role={role}
          userName={userName}
          userImage={user.imageUrl ?? undefined}
          userEmail={user.email}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="overflow-x-hidden relative flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Subtle dot-grid background layered behind the content */}
          <div
            aria-hidden
            className="dot-grid pointer-events-none absolute inset-0 opacity-[0.35] mask-[radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          />
          {/* Aurora wash */}
          <div
            aria-hidden
            className="aurora-bg pointer-events-none absolute inset-0 opacity-40 mask-[linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
          />
          <div className="relative z-10 animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
