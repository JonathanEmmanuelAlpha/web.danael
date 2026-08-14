"use client";

import { useTranslations } from "next-intl";
import {
  Menu,
  Search,
  LogOut,
  Settings,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { useRouter } from "next/navigation";
import { useUserStore, selectUserInitials } from "@/stores/user-store";
import { useSchoolStore, selectCurrentSchool } from "@/stores/school-store";
import {
  useNotificationsStore,
  selectUnreadCount,
} from "@/stores/notifications-store";
import { useClerk } from "@clerk/nextjs";

export interface TopbarProps {
  role: UserRole;
  userName?: string;
  userImage?: string;
  userEmail?: string;
  onMenuClick?: () => void;
  className?: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Élève",
  teacher: "Enseignant",
  school_admin: "École",
  parent: "Parent",
  tutor: "Tuteur",
  platform_admin: "Admin",
  content_moderator: "Modérateur",
  support: "Support",
};

/**
 * Top navigation bar (§6.3): search, notifications, language, theme, profile.
 *
 * Refonte "Aurora Navy":
 *  - glass surface with a gradient bottom border (primary → cyan)
 *  - search input with a glow ring on focus
 *  - school chip with glow-primary-sm
 *  - icon buttons hover with a subtle glass lift
 *  - avatar gets a primary ring on hover
 *  - profile dropdown uses glass-strong + spring scale-in
 *  - notification bell wrapper pulses when there are unread items
 *
 * IMPORTANT: This component NO LONGER calls useUser() on every render.
 * The user data is passed as props from the server (via getCurrentDbUser)
 * and hydrated into Zustand stores. We read from the store here, falling
 * back to props for the very first render before hydration completes.
 */
export function Topbar({
  role,
  userName,
  userImage,
  userEmail,
  onMenuClick,
  className,
}: TopbarProps) {
  const t = useTranslations("Navigation");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const { signOut } = useClerk();

  // Read from Zustand store — no Clerk API calls here!
  // We pass the props as fallback so the very first paint (before hydration)
  // shows the right data.
  const storeUser = useUserStore((s) => s.user);
  const currentSchool = useSchoolStore(selectCurrentSchool);
  const unreadCount = useNotificationsStore(selectUnreadCount);

  const displayName = storeUser
    ? [storeUser.firstName, storeUser.lastName].filter(Boolean).join(" ") ||
      storeUser.email
    : (userName ?? "Utilisateur");
  const initials = storeUser
    ? selectUserInitials({ user: storeUser } as never)
    : (displayName ?? "?").slice(0, 2).toUpperCase();
  const avatarUrl = storeUser?.avatarUrl ?? storeUser?.imageUrl ?? userImage;
  const email = storeUser?.email ?? userEmail ?? "";

  function handleSignOut() {
    // Clear local stores before signing out
    useUserStore.getState().clear();
    useSchoolStore.getState().clear();
    if (signOut) {
      void signOut(() => router.push("/sign-in"));
    }
  }

  const hasUnread = unreadCount > 0;

  return (
    <header
      className={cn(
        "glass sticky top-0 z-30 flex h-16 items-center gap-3 px-4 sm:px-6",
        "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-primary-500/40 before:to-accent-cyan-400/30",
        className,
      )}
    >
      {/* Mobile menu */}
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="glass rounded-lg border border-transparent transition-all duration-200 hover:border-border-strong hover:bg-surface-3 lg:hidden"
          onClick={onMenuClick}
          aria-label="Menu"
        >
          <Menu className="size-5" />
        </Button>
      )}

      {/* Current school chip (if any) */}
      {currentSchool && (
        <div
          className={cn(
            "hidden items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/[0.08] px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 md:flex",
            "glow-primary-sm",
          )}
        >
          <span className="size-1.5 animate-pulse-glow rounded-full bg-primary-500" />
          <span className="max-w-[180px] truncate">{currentSchool.name}</span>
        </div>
      )}

      {/* Search */}
      <div className="group relative hidden flex-1 max-w-md sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary-500" />
        <Input
          type="search"
          placeholder={tCommon("search")}
          aria-label={tCommon("search")}
          className={cn(
            "h-9 rounded-lg border-border bg-input-bg/60 pl-9 transition-all duration-200",
            "placeholder:text-muted-foreground/70",
            "hover:border-border-strong",
            "focus-visible:border-primary-500 focus-visible:bg-input-bg-focus focus-visible:shadow-[0_0_0_3px_rgba(147,217,26,0.18)] focus-visible:glow-primary-sm",
          )}
        />
      </div>
      <div className="flex-1 sm:hidden" />

      {/* Right cluster */}
      <div className="flex items-center gap-1.5">
        {/* Notifications — wrapper pulses when there are unread items */}
        <div
          className={cn(
            "relative rounded-lg",
            hasUnread && "animate-pulse-glow",
          )}
          aria-live="polite"
        >
          <NotificationBell />
        </div>

        <LanguageSwitcher />
        <ThemeToggle />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "ml-1 flex items-center gap-2 rounded-full p-0.5 pr-2 transition-all duration-200",
                "hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40",
                className,
              )}
              aria-label="Profile"
            >
              <Avatar
                className={cn(
                  "size-9 border border-border transition-all duration-200",
                  "hover:ring-2 hover:ring-primary-500/50 hover:ring-offset-2 hover:ring-offset-background",
                )}
              >
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-primary-500/15 text-xs font-semibold text-primary-700 dark:text-primary-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground sm:inline">
                {displayName?.split(" ")[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(
              "glass-strong min-w-56 animate-scale-in border-border-strong p-1",
              "data-[state=open]:animate-scale-in",
            )}
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                {displayName}
              </span>
              {email && (
                <span className="text-xs text-muted-foreground">{email}</span>
              )}
              <span className="mt-1 inline-flex w-fit rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                {ROLE_LABELS[role]}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="cursor-pointer rounded-md transition-colors hover:bg-primary-500/10 hover:text-primary-700 dark:hover:text-primary-300 focus:bg-primary-500/10 focus:text-primary-700 dark:focus:text-primary-300"
            >
              <Settings className="size-4 mr-2" />
              {t("settings")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/messages")}
              className="cursor-pointer rounded-md transition-colors hover:bg-primary-500/10 hover:text-primary-700 dark:hover:text-primary-300 focus:bg-primary-500/10 focus:text-primary-700 dark:focus:text-primary-300"
            >
              <MessageSquare className="size-4 mr-2" />
              {t("messages")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/help")}
              className="cursor-pointer rounded-md transition-colors hover:bg-primary-500/10 hover:text-primary-700 dark:hover:text-primary-300 focus:bg-primary-500/10 focus:text-primary-700 dark:focus:text-primary-300"
            >
              <HelpCircle className="size-4 mr-2" />
              {t("help")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer rounded-md text-accent-coral-400 transition-colors hover:bg-accent-coral-500/10 hover:text-accent-coral-300 focus:bg-accent-coral-500/10 focus:text-accent-coral-300"
            >
              <LogOut className="size-4 mr-2" />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
