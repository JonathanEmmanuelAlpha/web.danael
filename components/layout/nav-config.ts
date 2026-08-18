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
  Flag,
  ScrollText,
  Brain,
  Target,
  GitBranch,
  Briefcase,
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
 *
 * Each role has a distinct sidebar structure adapted to its use cases:
 *  - student: learn + me sections
 *  - teacher: teach + me sections
 *  - school_admin: school management sections
 *  - parent: children + family sections
 *  - tutor: tutoring business sections
 *  - platform_admin: full platform admin with oversight + moderation + system sections
 *  - content_moderator: focused on moderation queue + content review
 *  - support: focused on user support + messaging
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
          href: "/assignments",
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
      titleKey: "talent",
      items: [
        { href: "/student/talent", labelKey: "talentDashboard", icon: Brain },
        { href: "/student/talent/track", labelKey: "myTrack", icon: Target },
        {
          href: "/student/talent/challenges",
          labelKey: "challengesLibrary",
          icon: Trophy,
        },
        {
          href: "/student/talent/tree",
          labelKey: "talentTree",
          icon: GitBranch,
        },
        {
          href: "/student/talent/mentor",
          labelKey: "socraticMentor",
          icon: Sparkles,
        },
        {
          href: "/student/talent/career",
          labelKey: "careerHorizon",
          icon: Briefcase,
        },
        {
          href: "/student/talent/cohorts",
          labelKey: "cohorts",
          icon: Users,
        },
        {
          href: "/student/talent/showcase",
          labelKey: "showcase",
          icon: Star,
        },
      ],
    },
    {
      titleKey: "me",
      items: [
        { href: "/student/progress", labelKey: "progress", icon: TrendingUp },
        { href: "/student/badges", labelKey: "badges", icon: Award },
        { href: "/student/favorites", labelKey: "favorites", icon: Star },
        {
          href: "/student/learning/diagnostic",
          labelKey: "diagnostic",
          icon: ClipboardCheck,
        },
        { href: "/student/my-school", labelKey: "mySchool", icon: School },
        { href: "/classes", labelKey: "classes", icon: School },
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
        { href: "/classes", labelKey: "classes", icon: School },
        { href: "/teacher/quizzes", labelKey: "quizzes", icon: HelpCircle },
        {
          href: "/assignments",
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
        { href: "/teacher/analytics", labelKey: "analytics", icon: BarChart3 },
      ],
    },
    {
      titleKey: "talent",
      items: [
        {
          href: "/teacher/talent-roster",
          labelKey: "talentRoster",
          icon: Brain,
        },
        {
          href: "/teacher/talent-challenges",
          labelKey: "talentChallenges",
          icon: Target,
        },
      ],
    },
    {
      titleKey: "me",
      items: [
        { href: "/teacher/my-school", labelKey: "mySchool", icon: School },
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
        {
          href: "/school/dashboard",
          labelKey: "dashboard",
          icon: LayoutDashboard,
        },
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
        { href: "/classes", labelKey: "classes", icon: School },
        { href: "/school/subjects", labelKey: "subjects", icon: BookOpen },
        { href: "/requests", labelKey: "requests", icon: Inbox },
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
        { href: "/tutor/profile", labelKey: "profile", icon: Users },
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
        { href: "/admin/analytics", labelKey: "analytics", icon: BarChart3 },
      ],
    },
    {
      titleKey: "platform",
      items: [
        { href: "/admin/users", labelKey: "users", icon: Users },
        { href: "/admin/schools", labelKey: "schools", icon: School },
        { href: "/admin/subjects", labelKey: "subjects", icon: BookOpen },
        {
          href: "/admin/subscriptions",
          labelKey: "subscriptions",
          icon: CreditCard,
        },
        { href: "/admin/payments", labelKey: "payments", icon: DollarSign },
      ],
    },
    {
      titleKey: "moderation",
      items: [
        { href: "/admin/contents", labelKey: "contents", icon: FolderOpen },
        {
          href: "/admin/moderation",
          labelKey: "moderation",
          icon: ShieldAlert,
        },
      ],
    },
    {
      titleKey: "talent",
      items: [
        { href: "/admin/talent", labelKey: "talentHealth", icon: Brain },
      ],
    },
    {
      titleKey: "system",
      items: [
        { href: "/admin/audit", labelKey: "audit", icon: ScrollText },
        { href: "/admin/feature-flags", labelKey: "featureFlags", icon: Flag },
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
    {
      titleKey: "me",
      items: [
        { href: "/messages", labelKey: "messages", icon: MessageSquare },
        { href: "/settings", labelKey: "settings", icon: Settings },
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
    {
      titleKey: "me",
      items: [{ href: "/settings", labelKey: "settings", icon: Settings }],
    },
  ],
};

/** Section labels i18n keys (resolved against "Navigation.sections"). */
export const SECTION_LABELS: Record<string, string> = {
  learn: "sections.learn",
  teach: "sections.teach",
  school: "sections.school",
  me: "sections.me",
  platform: "sections.platform",
  moderation: "sections.moderation",
  system: "sections.system",
  talent: "sections.talent",
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
