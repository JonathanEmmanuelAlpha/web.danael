"use client";

/**
 * §5.11 — "New conversation" dialog.
 *
 * Multi-step flow that adapts to the user's role:
 *
 *  - student / teacher / school_admin:
 *      Step 1 — pick a class ("My classes" +, for school_admin, "All school classes")
 *      Step 2 — pick a member of that class
 *  - parent:
 *      Step 1 — pick a child (immediately starts the conversation)
 *  - tutor:
 *      Step 1 — pick a tutored student (immediately starts the conversation)
 *  - platform_admin / support / content_moderator:
 *      Step 1 — pick a class (falls back to "My classes" — empty state if none)
 *
 * On click of a recipient (class member / child / tutoring student), the
 * dialog calls `startConversationAction` and redirects to
 * `/messages/{threadId}` on success.
 *
 * The dialog is mostly click-based (no TanStack Form needed); a search
 * Input filters the lists. Skeletons + EmptyState handle loading + empty
 * states.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  GraduationCap,
  Loader2,
  MessageSquarePlus,
  Search,
  School as SchoolIcon,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";
import type { UserRole } from "@/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";

import {
  getClassMembersAction,
  getMyChildrenAction,
  getMyClassesForMessagingAction,
  getMyTutoringStudentsAction,
  getSchoolClassesAction,
  startConversationAction,
  type ChildForMessaging,
  type ClassForMessaging,
  type ClassMemberForMessaging,
  type TutoringStudentForMessaging,
} from "@/server/actions/messaging";

export interface NewConversationDialogProps {
  /** Custom trigger node. When omitted, a default brand button is rendered. */
  trigger?: React.ReactNode;
  /** Override the role (defaults to the user-store role). */
  role?: UserRole;
}

type Step = "context" | "members" | "loading";

/* ── Helpers ─────────────────────────────────────────────────── */

function peerInitials(p: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const f = p.firstName?.[0] ?? "";
  const l = p.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function peerName(p: {
  firstName: string | null;
  lastName: string | null;
}): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
}

/** Map a class_member role to a Badge variant + label key. */
function roleBadgeConfig(roleInClass: ClassMemberForMessaging["roleInClass"]): {
  variant: "warning" | "info" | "violet" | "secondary" | "default";
  labelKey: "roleTeacher" | "roleStudent" | "roleAdmin" | "roleParent" | "roleStaff";
} {
  switch (roleInClass) {
    case "teacher":
      return { variant: "warning", labelKey: "roleTeacher" };
    case "student":
      return { variant: "info", labelKey: "roleStudent" };
    case "admin":
      return { variant: "violet", labelKey: "roleAdmin" };
    case "parent":
      return { variant: "default", labelKey: "roleParent" };
    case "staff":
    default:
      return { variant: "secondary", labelKey: "roleStaff" };
  }
}

/* ── Sub-components ──────────────────────────────────────────── */

interface ClassCardProps {
  cls: ClassForMessaging;
  onClick: () => void;
  memberCountLabel: string;
}

function ClassCard({ cls, onClick, memberCountLabel }: ClassCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-card group flex w-full items-center gap-3 rounded-xl p-3 text-left",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-500/40",
        "hover:shadow-[0_0_20px_-4px_rgba(147,217,26,0.3)] focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary-500/40",
      )}
    >
      <div
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300"
      >
        <SchoolIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {cls.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {cls.schoolName || cls.schoolId}
          {cls.level ? ` · ${cls.level}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3" aria-hidden />
        <span>{memberCountLabel}</span>
      </div>
    </button>
  );
}

interface PersonRowProps {
  avatarUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  subtitle?: string;
  badge?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

function PersonRow({
  avatarUrl,
  firstName,
  lastName,
  subtitle,
  badge,
  onClick,
  disabled,
}: PersonRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "glass-card group flex w-full items-center gap-3 rounded-xl p-3 text-left",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-500/40",
        "hover:shadow-[0_0_20px_-4px_rgba(147,217,26,0.3)] focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary-500/40",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
      )}
    >
      <Avatar className="size-10 shrink-0">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="bg-primary-500/15 text-xs font-semibold text-primary-300">
          {peerInitials({ firstName, lastName })}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {peerName({ firstName, lastName })}
        </p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </button>
  );
}

/* ── Main dialog ─────────────────────────────────────────────── */

export function NewConversationDialog({
  trigger,
  role: roleOverride,
}: NewConversationDialogProps) {
  const t = useTranslations("Messaging");
  const router = useRouter();

  const storeUser = useUserStore((s) => s.user);
  const role = (roleOverride ?? storeUser?.role ?? "student") as UserRole;

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("context");
  const [selectedClass, setSelectedClass] =
    React.useState<ClassForMessaging | null>(null);
  const [search, setSearch] = React.useState("");

  // Data states — `null` means "not yet loaded", `[]` means "loaded empty".
  const [myClasses, setMyClasses] = React.useState<ClassForMessaging[] | null>(
    null,
  );
  const [schoolClasses, setSchoolClasses] = React.useState<
    ClassForMessaging[] | null
  >(null);
  const [members, setMembers] = React.useState<ClassMemberForMessaging[] | null>(
    null,
  );
  const [children, setChildren] = React.useState<ChildForMessaging[] | null>(
    null,
  );
  const [tutoringStudents, setTutoringStudents] = React.useState<
    TutoringStudentForMessaging[] | null
  >(null);

  /* Reset step state synchronously when the dialog opens (no effect needed). */
  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) {
      setStep("context");
      setSelectedClass(null);
      setSearch("");
      setMembers(null);
      // myClasses / schoolClasses / children / tutoringStudents are
      // re-fetched lazily via dedicated effects when entering the relevant step.
    }
    setOpen(nextOpen);
  }

  /**
   * STEP 1 — load the role-appropriate context list when the dialog opens.
   */
  React.useEffect(() => {
    if (!open) return;
    if (step !== "context") return;

    // Parent → load children.
    if (role === "parent") {
      if (children !== null) return;
      let cancelled = false;
      void getMyChildrenAction().then((res) => {
        if (cancelled) return;
        if (res.success) setChildren(res.data);
        else {
          setChildren([]);
          toast.error(res.error?.message ?? t("conversationStartFailed"));
        }
      });
      return () => {
        cancelled = true;
      };
    }

    // Tutor → load tutoring students.
    if (role === "tutor") {
      if (tutoringStudents !== null) return;
      let cancelled = false;
      void getMyTutoringStudentsAction().then((res) => {
        if (cancelled) return;
        if (res.success) setTutoringStudents(res.data);
        else {
          setTutoringStudents([]);
          toast.error(res.error?.message ?? t("conversationStartFailed"));
        }
      });
      return () => {
        cancelled = true;
      };
    }

    // student / teacher / school_admin / platform_admin / support → load "My classes".
    if (myClasses !== null) return;
    let cancelled = false;
    void getMyClassesForMessagingAction().then((res) => {
      if (cancelled) return;
      if (res.success) setMyClasses(res.data);
      else {
        setMyClasses([]);
        toast.error(res.error?.message ?? t("conversationStartFailed"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, step, role, children, tutoringStudents, myClasses, t]);

  /**
   * STEP 1 — for school_admin, also load "All school classes" once the
   * user's own school is known (we piggy-back on the first myClasses row's
   * schoolId).
   */
  React.useEffect(() => {
    if (!open || step !== "context") return;
    if (role !== "school_admin") return;
    if (schoolClasses !== null) return;
    if (!myClasses || myClasses.length === 0) return;

    const schoolId = myClasses[0].schoolId;
    if (!schoolId) return;
    let cancelled = false;
    void getSchoolClassesAction(schoolId).then((res) => {
      if (cancelled) return;
      if (res.success) {
        // Deduplicate classes already shown in "My classes" (don't show twice).
        const mine = new Set(myClasses.map((c) => c.id));
        setSchoolClasses(res.data.filter((c) => !mine.has(c.id)));
      } else {
        setSchoolClasses([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, step, role, schoolClasses, myClasses]);

  /**
   * STEP 2 — load class members when the user selects a class.
   */
  React.useEffect(() => {
    if (step !== "members" || !selectedClass) return;
    if (members !== null) return;
    let cancelled = false;
    void getClassMembersAction(selectedClass.id).then((res) => {
      if (cancelled) return;
      if (res.success) setMembers(res.data);
      else {
        setMembers([]);
        toast.error(res.error?.message ?? t("conversationStartFailed"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, selectedClass, members, t]);

  /* Start conversation + redirect. */
  async function startConversation(participantId: string): Promise<void> {
    setStep("loading");
    const res = await startConversationAction({
      participantId,
      classId: selectedClass?.id,
      schoolId: selectedClass?.schoolId,
    });
    if (!res.success) {
      toast.error(res.error?.message ?? t("conversationStartFailed"));
      setStep(selectedClass ? "members" : "context");
      return;
    }
    toast.success(t("conversationStarted"));
    setOpen(false);
    router.push(`/messages/${res.data.threadId}`);
  }

  /* Search filter helpers. */
  function filterClasses(list: ClassForMessaging[]): ClassForMessaging[] {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.schoolName.toLowerCase().includes(q) ||
        (c.level ?? "").toLowerCase().includes(q),
    );
  }

  function filterPeople<
    T extends { firstName: string | null; lastName: string | null; email: string },
  >(list: T[]): T[] {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) =>
      peerName(p).toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    );
  }

  /* Compute step title + description. */
  const stepTitle: string = (() => {
    if (step === "loading") return t("starting");
    if (role === "parent") return t("selectChild");
    if (role === "tutor") return t("selectStudent");
    if (step === "members") return t("selectRecipient");
    return t("selectClass");
  })();

  const stepDescription: string = (() => {
    if (step === "loading") return "";
    return t("newConversationDescription");
  })();

  const showBackButton = step === "members";
  const showSearch = step !== "loading";
  const searchPlaceholder =
    role === "parent" || role === "tutor" || step === "members"
      ? t("searchMembers")
      : t("searchClasses");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand" size="sm">
            <MessageSquarePlus className="size-4" />
            {t("newConversation")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "glass-strong animate-scale-in sm:max-w-lg",
          // Larger viewport on desktop so the lists breathe.
          "max-h-[85vh] gap-0 p-0",
        )}
        // The default close button is fine — it sits in the top-right corner.
      >
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("back")}
                onClick={() => {
                  setStep("context");
                  setSelectedClass(null);
                  setMembers(null);
                  setSearch("");
                }}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                <MessageSquarePlus
                  className="size-4 text-primary-400"
                  aria-hidden
                />
                <span className="truncate">{stepTitle}</span>
              </DialogTitle>
              {stepDescription && (
                <DialogDescription className="mt-0.5 truncate text-xs">
                  {stepDescription}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Search bar */}
        {showSearch && (
          <div className="border-b border-border px-4 py-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 pl-9 text-sm"
              />
            </div>
          </div>
        )}

        {/* Body — scrollable list */}
        <ScrollArea className="max-h-[55vh] min-h-[260px] flex-1">
          <div className="p-4">
            {step === "loading" ? (
              <LoadingView label={t("starting")} />
            ) : role === "parent" ? (
              <ParentList
                items={children}
                filtered={filterPeople(children ?? [])}
                onPick={(child) => void startConversation(child.id)}
              />
            ) : role === "tutor" ? (
              <TutorList
                students={tutoringStudents}
                filtered={filterPeople(tutoringStudents ?? [])}
                onPick={(s) => void startConversation(s.id)}
              />
            ) : step === "members" ? (
              <MembersList
                members={members}
                filtered={filterPeople(members ?? [])}
                onPick={(m) => void startConversation(m.id)}
                roleLabel={t}
              />
            ) : (
              <ClassesList
                myClasses={myClasses}
                schoolClasses={schoolClasses}
                isSchoolAdmin={role === "school_admin"}
                filteredMine={filterClasses(myClasses ?? [])}
                filteredSchool={filterClasses(schoolClasses ?? [])}
                onPick={(cls) => {
                  setSelectedClass(cls);
                  setMembers(null);
                  setSearch("");
                  setStep("members");
                }}
                roleLabel={t}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ── List views ──────────────────────────────────────────────── */

function LoadingView({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-primary-400" aria-hidden />
      <p className="animate-pulse text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

interface ParentListProps {
  items: ChildForMessaging[] | null;
  filtered: ChildForMessaging[];
  onPick: (child: ChildForMessaging) => void;
}

function ParentList({ items, filtered, onPick }: ParentListProps) {
  const t = useTranslations("Messaging");
  if (items === null) {
    return <ListSkeleton />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={t("noChildren")}
        description={t("noClassesHint")}
      />
    );
  }
  if (filtered.length === 0) {
    return <NoSearchResults />;
  }
  return (
    <div className="space-y-2">
      <SectionLabel icon={Users}>{t("myChildren")}</SectionLabel>
      <ul className="space-y-2">
        {filtered.map((child) => (
          <li key={child.id}>
            <PersonRow
              avatarUrl={child.avatarUrl}
              firstName={child.firstName}
              lastName={child.lastName}
              subtitle={child.relationship}
              badge={
                <Badge variant="default" size="sm">
                  {child.relationship}
                </Badge>
              }
              onClick={() => onPick(child)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface TutorListProps {
  students: TutoringStudentForMessaging[] | null;
  filtered: TutoringStudentForMessaging[];
  onPick: (s: TutoringStudentForMessaging) => void;
}

function TutorList({ students, filtered, onPick }: TutorListProps) {
  const t = useTranslations("Messaging");
  if (students === null) {
    return <ListSkeleton />;
  }
  if (students.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={t("noStudents")}
        description={t("noClassesHint")}
      />
    );
  }
  if (filtered.length === 0) {
    return <NoSearchResults />;
  }
  return (
    <div className="space-y-2">
      <SectionLabel icon={Users}>{t("myStudents")}</SectionLabel>
      <ul className="space-y-2">
        {filtered.map((s) => (
          <li key={s.id}>
            <PersonRow
              avatarUrl={s.avatarUrl}
              firstName={s.firstName}
              lastName={s.lastName}
              subtitle={s.email}
              onClick={() => onPick(s)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MembersListProps {
  members: ClassMemberForMessaging[] | null;
  filtered: ClassMemberForMessaging[];
  onPick: (m: ClassMemberForMessaging) => void;
  roleLabel: (key: string) => string;
}

function MembersList({ members, filtered, onPick, roleLabel }: MembersListProps) {
  const t = useTranslations("Messaging");
  if (members === null) {
    return <ListSkeleton />;
  }
  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("noMembers")}
        description={t("noClassesHint")}
      />
    );
  }
  if (filtered.length === 0) {
    return <NoSearchResults />;
  }
  return (
    <ul className="space-y-2">
      {filtered.map((m) => {
        const cfg = roleBadgeConfig(m.roleInClass);
        return (
          <li key={m.id}>
            <PersonRow
              avatarUrl={m.avatarUrl}
              firstName={m.firstName}
              lastName={m.lastName}
              subtitle={m.email}
              badge={
                <Badge variant={cfg.variant} size="sm">
                  {roleLabel(cfg.labelKey)}
                </Badge>
              }
              onClick={() => onPick(m)}
            />
          </li>
        );
      })}
    </ul>
  );
}

interface ClassesListProps {
  myClasses: ClassForMessaging[] | null;
  schoolClasses: ClassForMessaging[] | null;
  isSchoolAdmin: boolean;
  filteredMine: ClassForMessaging[];
  filteredSchool: ClassForMessaging[];
  onPick: (cls: ClassForMessaging) => void;
  roleLabel: (key: string) => string;
}

function ClassesList({
  myClasses,
  schoolClasses,
  isSchoolAdmin,
  filteredMine,
  filteredSchool,
  onPick,
  roleLabel,
}: ClassesListProps) {
  const t = useTranslations("Messaging");

  // Loading state — myClasses not yet fetched.
  if (myClasses === null) {
    return <ListSkeleton />;
  }

  // Empty state — user has no classes AND (school_admin with no school classes OR not a school_admin).
  const hasMine = myClasses.length > 0;
  const hasSchool = isSchoolAdmin && schoolClasses !== null && schoolClasses.length > 0;
  if (!hasMine && !hasSchool) {
    return (
      <EmptyState
        icon={SchoolIcon}
        title={t("noClasses")}
        description={t("noClassesHint")}
      />
    );
  }

  return (
    <div className="space-y-5">
      {hasMine && (
        <section className="space-y-2">
          <SectionLabel icon={Users}>{t("myClasses")}</SectionLabel>
          <ul className="space-y-2">
            {filteredMine.map((cls) => (
              <li key={cls.id}>
                <ClassCard
                  cls={cls}
                  onClick={() => onPick(cls)}
                  memberCountLabel={roleLabel("memberCount").replace(
                    "{count}",
                    String(cls.memberCount),
                  )}
                />
              </li>
            ))}
            {filteredMine.length === 0 && <NoSearchResults />}
          </ul>
        </section>
      )}

      {isSchoolAdmin && (
        <section className="space-y-2">
          <SectionLabel icon={SchoolIcon}>{t("allSchoolClasses")}</SectionLabel>
          {schoolClasses === null ? (
            <ListSkeleton count={2} />
          ) : schoolClasses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              {t("noClasses")}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredSchool.map((cls) => (
                <li key={cls.id}>
                  <ClassCard
                    cls={cls}
                    onClick={() => onPick(cls)}
                    memberCountLabel={roleLabel("memberCount").replace(
                      "{count}",
                      String(cls.memberCount),
                    )}
                  />
                </li>
              ))}
              {filteredSchool.length === 0 && <NoSearchResults />}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Small UI atoms ──────────────────────────────────────────── */

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="glass-card flex items-center gap-3 rounded-xl p-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-14 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function NoSearchResults() {
  const t = useTranslations("Messaging");
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
      {t("noMembers")}
    </div>
  );
}
