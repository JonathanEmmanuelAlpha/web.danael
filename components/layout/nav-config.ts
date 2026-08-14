import {
  LayoutDashboard,
  Library,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  HelpCircle,
  Trophy,
  Award,
  MessageSquare,
  TrendingUp,
  Settings,
  Users,
  GraduationCap,
  School,
  FolderOpen,
  CreditCard,
  DollarSign,
  Baby,
  CalendarClock,
  Star,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  Mail,
  Inbox,
  Send,
  Sparkles,
  Search,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types";
import type { Locale } from "@/i18n/constants";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  titleKey: string | null;
  items: NavItem[];
}

/**
 * Role-based navigation config (§6.3).
 * The labelKey is resolved against the "Navigation" namespace in messages.
 */
export const NAV_BY_ROLE: Record<UserRole, NavSection[]> = {
  student: [
    {
      titleKey: null,
      items: [
        {
          href: "/student/dashboard",
          labelKey: "dashboard",
          icon: LayoutDashboard,
        },
        { href: "/student/today", labelKey: "today", icon: CalendarClock },
      ],
    },
    {
      titleKey: "learn",
      items: [
        { href: "/student/learning", labelKey: "learning", icon: Sparkles },
        { href: "/student/library", labelKey: "library", icon: Library },
        {
          href: "/student/assignments",
          labelKey: "assignments",
          icon: ClipboardList,
        },
        { href: "/student/quizzes", labelKey: "quizzes", icon: HelpCircle },
        {
          href: "/student/competitions",
          labelKey: "competitions",
          icon: Trophy,
        },
      ],
    },
    {
      titleKey: "me",
      items: [
        { href: "/student/progress", labelKey: "progress", icon: TrendingUp },
        { href: "/student/badges", labelKey: "badges", icon: Award },
        {
          href: "/student/learning/diagnostic",
          labelKey: "diagnostic",
          icon: ClipboardCheck,
        },
        { href: "/tutors", labelKey: "tutors", icon: GraduationCap },
        { href: "/invitations", labelKey: "invitations", icon: Mail },
        { href: "/my-requests", labelKey: "myRequests", icon: Send },
        { href: "/messages", labelKey: "messages", icon: MessageSquare },
        { href: "/settings", labelKey: "settings", icon: Settings },
      ],
    },
  ],
  teacher: [
    {
      titleKey: null,
      items: [
        {
          href: "/teacher/dashboard",
          labelKey: "dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      titleKey: "teach",
      items: [
        { href: "/teacher/classes", labelKey: "classes", icon: School },
        { href: "/teacher/quizzes", labelKey: "quizzes", icon: HelpCircle },
        {
          href: "/teacher/assignments",
          labelKey: "assignments",
          icon: ClipboardList,
        },
        { href: "/teacher/gradebook", labelKey: "gradebook", icon: BookOpen },
        { href: "/teacher/attendance", labelKey: "attendance", icon: Users },
        { href: "/teacher/contents", labelKey: "contents", icon: FolderOpen },
        {
          href: "/teacher/competitions",
          labelKey: "competitions",
          icon: Trophy,
        },
        {
          href: "/teacher/questions",
          labelKey: "aiQuestions",
          icon: ShieldCheck,
        },
      ],
    },
    {
      titleKey: "me",
      items: [
        { href: "/invitations", labelKey: "invitations", icon: Mail },
        { href: "/my-requests", labelKey: "myRequests", icon: Send },
        { href: "/messages", labelKey: "messages", icon: MessageSquare },
        { href: "/settings", labelKey: "settings", icon: Settings },
      ],
    },
  ],
  school_admin: [
    {
      titleKey: null,
      items: [
        { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
      ],
    },
    {
      titleKey: "school",
      items: [
        { href: "/school/teachers", labelKey: "teachers", icon: GraduationCap },
        {
          href: "/school/teachers/find",
          labelKey: "findTeachers",
          icon: Search,
        },
        { href: "/school/students", labelKey: "students", icon: Users },
        {
          href: "/school/students/find",
          labelKey: "findStudents",
          icon: Search,
        },
        { href: "/school/classes", labelKey: "classes", icon: School },
        { href: "/school/requests", labelKey: "requests", icon: Inbox },
        {
          href: "/school/access-codes",
          labelKey: "accessCodes",
          icon: KeyRound,
        },
        {
          href: "/school/access-requests",
          labelKey: "accessRequests",
          icon: Inbox,
        },
        { href: "/school/contents", labelKey: "contents", icon: FolderOpen },
        {
          href: "/school/competitions",
          labelKey: "competitions",
          icon: Trophy,
        },
        { href: "/school/analytics", labelKey: "analytics", icon: BarChart3 },
        { href: "/school/billing", labelKey: "billing", icon: CreditCard },
      ],
    },
    {
      titleKey: "me",
      items: [
        { href: "/invitations", labelKey: "invitations", icon: Mail },
        { href: "/settings", labelKey: "settings", icon: Settings },
      ],
    },
  ],
  parent: [
    {
      titleKey: null,
      items: [
        {
          href: "/parent/dashboard",
          labelKey: "dashboard",
          icon: LayoutDashboard,
        },
        { href: "/parent/children", labelKey: "children", icon: Baby },
        { href: "/parent/tutors", labelKey: "tutors", icon: GraduationCap },
        { href: "/parent/billing", labelKey: "billing", icon: CreditCard },
        { href: "/parent/messages", labelKey: "messages", icon: MessageSquare },
      ],
    },
    {
      titleKey: "me",
      items: [{ href: "/settings", labelKey: "settings", icon: Settings }],
    },
  ],
  tutor: [
    {
      titleKey: null,
      items: [
        {
          href: "/tutor/dashboard",
          labelKey: "dashboard",
          icon: LayoutDashboard,
        },
        { href: "/tutor/bookings", labelKey: "bookings", icon: CalendarClock },
        { href: "/tutor/earnings", labelKey: "earnings", icon: DollarSign },
        { href: "/tutor/reviews", labelKey: "reviews", icon: Star },
      ],
    },
    {
      titleKey: "me",
      items: [
        { href: "/profile", labelKey: "profile", icon: Users },
        { href: "/settings", labelKey: "settings", icon: Settings },
      ],
    },
  ],
  platform_admin: [
    {
      titleKey: null,
      items: [
        {
          href: "/admin/dashboard",
          labelKey: "dashboard",
          icon: LayoutDashboard,
        },
        { href: "/admin/users", labelKey: "users", icon: Users },
        { href: "/admin/schools", labelKey: "schools", icon: School },
        { href: "/admin/contents", labelKey: "contents", icon: FolderOpen },
        {
          href: "/admin/subscriptions",
          labelKey: "subscriptions",
          icon: CreditCard,
        },
        { href: "/admin/payments", labelKey: "payments", icon: DollarSign },
        {
          href: "/admin/moderation",
          labelKey: "moderation",
          icon: ShieldAlert,
        },
        { href: "/admin/analytics", labelKey: "analytics", icon: BarChart3 },
      ],
    },
  ],
  content_moderator: [
    {
      titleKey: null,
      items: [
        {
          href: "/admin/moderation",
          labelKey: "moderation",
          icon: ShieldAlert,
        },
        { href: "/admin/contents", labelKey: "contents", icon: FolderOpen },
      ],
    },
  ],
  support: [
    {
      titleKey: null,
      items: [
        { href: "/admin/users", labelKey: "users", icon: Users },
        { href: "/messages", labelKey: "messages", icon: MessageSquare },
      ],
    },
  ],
};

/** Section labels i18n keys (resolved against "Navigation.sections"). */
export const SECTION_LABELS: Record<string, string> = {
  learn: "sections.learn",
  teach: "sections.teach",
  school: "sections.school",
  me: "sections.me",
};

export function getNavForRole(role: UserRole): NavSection[] {
  return NAV_BY_ROLE[role] ?? NAV_BY_ROLE.student;
}

export function isPathActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/admin/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type { Locale };
