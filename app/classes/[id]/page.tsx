import { notFound, redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { ClassMembersList } from "@/components/schools/class-members-list";
import { ClassSubjectsList } from "@/components/schools/class-subjects-list";
import { InviteCodeField } from "@/components/schools/invite-code-field";
import { getClassAction } from "@/server/actions/classes";
import {
  isClassMember,
  isClassTeacher,
  isSchoolMember,
} from "@/server/permissions";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { classMembers } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  BookOpen,
  GraduationCap,
  School as SchoolIcon,
  ArrowRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";
import Link from "next/link";

/**
 * §5.3 — Class detail page (members, subjects, stats).
 *
 * Role-aware: school_admin/teacher can manage (invite, remove, assign
 * subjects). Students can view only.
 */
export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const tCls = await getTranslations("Classes");
  const tNav = await getTranslations("Navigation");
  const role = user.role as UserRole;

  const clsRes = await getClassAction(id);
  if (!clsRes.success || !clsRes.data) {
    notFound();
  }
  const cls = clsRes.data;

  // Determine if the user can manage this class.
  const [isTeacher, isMember, inSchool] = await Promise.all([
    isClassTeacher(user.id, id),
    isClassMember(user.id, id),
    cls.school?.id ? isSchoolMember(user.id, cls.school.id) : false,
  ]);

  // Access control: must be a member, in the school, or a platform admin.
  if (!isMember && !inSchool && role !== "platform_admin") {
    notFound();
  }

  const canManage =
    role === "platform_admin" ||
    isTeacher ||
    (inSchool && role === "school_admin");

  // Also fetch current user's class_member role so we can show a "you are a
  // student here" badge.
  const db = await getDb();
  const memberRows = await db
    .select()
    .from(classMembers)
    .where(and(eq(classMembers.classId, id), eq(classMembers.userId, user.id)))
    .limit(1);
  const myMember = memberRows.at(0) ?? null;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={cls.name}
          description={[
            cls.level ? tCls(`levelLabels.${cls.level}` as never) : null,
            cls.series ? `Série ${cls.series}` : null,
            cls.academicYear,
          ]
            .filter(Boolean)
            .join(" · ")}
          icon={<SchoolIcon className="size-6" />}
          breadcrumbs={
            <nav className="flex items-center gap-1 text-xs text-muted-foreground">
              <a
                href="/classes"
                className="hover:text-foreground hover:underline"
              >
                {tNav("classes")}
              </a>
              <span aria-hidden>/</span>
              <span className="text-foreground">{cls.name}</span>
            </nav>
          }
          actions={
            myMember && (
              <Badge variant="brand" size="lg">
                {myMember.role}
              </Badge>
            )
          }
        />

        {cls.school && (
          <p className="text-sm text-muted-foreground">
            {cls.school.name}
            {cls.headTeacher
              ? ` · ${tCls("headTeacher")}: ${[cls.headTeacher.firstName, cls.headTeacher.lastName].filter(Boolean).join(" ") || cls.headTeacher.email}`
              : ""}
          </p>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label={tCls("students")}
            value={cls.studentsCount}
            icon={Users}
            accent="emerald"
          />
          <StatCard
            label={tCls("teachers")}
            value={cls.teachersCount}
            icon={GraduationCap}
            accent="primary"
          />
          <StatCard
            label={tCls("subjects")}
            value={cls.subjectsCount}
            icon={BookOpen}
            accent="amber"
          />
        </div>

        {/* Invite code (visible to teachers / admins only) */}
        {canManage && cls.inviteCode && (
          <SectionCard
            title={tCls("inviteCode")}
            icon={<SchoolIcon className="size-4" />}
          >
            <InviteCodeField code={cls.inviteCode} />
          </SectionCard>
        )}

        {/* Subjects */}
        <SectionCard
          title={tCls("subjects")}
          icon={<BookOpen className="size-4" />}
          description={tCls("coefficient")}
        >
          <ClassSubjectsList classId={id} canManage={canManage} />
        </SectionCard>

        {/* Members */}
        <SectionCard
          title={tCls("members")}
          icon={<Users className="size-4" />}
          action={
            <Link
              href={`/classes/${cls.id}/requests`}
              className="flex items-center space-x-1.5 text-primary-400 border border-primary-400 px-4 py-2 rounded-lg bg-primary-400/10 hover:bg-primary-400 hover:text-primary-foreground transition-all duration-200"
            >
              <span className="text-sm font-medium">
                {tCls("classJoinRequestLink")}
              </span>
              <ArrowRight className="size-5" />
            </Link>
          }
        >
          <ClassMembersList classId={id} canManage={canManage} />
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
