import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { School } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getCurrentDbUser } from "@/lib/clerk";
import { getDb } from "@/server/db";
import {
  classes,
  classMembers,
  schools,
  schoolMembers,
  users,
} from "@/server/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import {
  MySchoolExplorer,
  type MyClassSummary,
  type MySchoolSummary,
  type MySchoolType,
} from "@/components/schools/my-school-explorer";

/**
 * §5.3 — "My School" page (student).
 *
 * Lists the active schools the current student is a member of, and for
 * each school the classes they are enrolled in. The selection happens
 * client-side in the `MySchoolExplorer` component.
 */
export default async function StudentMySchoolPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const tNav = await getTranslations("Navigation");
  const db = await getDb();

  // 1) Active schools the student is a member of — ordered by name asc.
  const schoolRows = await db
    .select({
      id: schools.id,
      name: schools.name,
      slug: schools.slug,
      logoUrl: schools.logoUrl,
      city: schools.city,
      region: schools.region,
      type: schools.type,
    })
    .from(schoolMembers)
    .innerJoin(schools, eq(schoolMembers.schoolId, schools.id))
    .where(
      and(eq(schoolMembers.userId, user.id), eq(schoolMembers.status, "active")),
    )
    .orderBy(asc(schools.name));

  // 2) All classes the student is a member of, joined with the class'
  //    school + head teacher for display.
  const classRows = await db
    .select({
      id: classes.id,
      name: classes.name,
      level: classes.level,
      series: classes.series,
      academicYear: classes.academicYear,
      schoolId: classes.schoolId,
      headTeacherFirstName: users.firstName,
      headTeacherLastName: users.lastName,
      headTeacherEmail: users.email,
    })
    .from(classMembers)
    .innerJoin(classes, eq(classMembers.classId, classes.id))
    .leftJoin(users, eq(classes.headTeacherId, users.id))
    .where(eq(classMembers.userId, user.id));

  // 3) Group classes by schoolId (only for the active schools above).
  const schoolIds = new Set(schoolRows.map((s) => s.id));
  const classesBySchool: Record<string, MyClassSummary[]> = {};
  for (const school of schoolRows) {
    classesBySchool[school.id] = [];
  }
  for (const row of classRows) {
    if (!schoolIds.has(row.schoolId)) continue;
    const headName =
      [row.headTeacherFirstName, row.headTeacherLastName]
        .filter(Boolean)
        .join(" ") || row.headTeacherEmail || null;
    classesBySchool[row.schoolId].push({
      id: row.id,
      name: row.name,
      level: row.level,
      series: row.series,
      academicYear: row.academicYear,
      headTeacherName: headName,
    });
  }

  const schoolsData: MySchoolSummary[] = schoolRows.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    logoUrl: s.logoUrl,
    city: s.city,
    region: s.region,
    type: (s.type as MySchoolType | null) ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("mySchoolTitle")}
        description={tNav("mySchoolDescription")}
        icon={<School className="size-6" />}
      />
      <MySchoolExplorer
        schools={schoolsData}
        classesBySchool={classesBySchool}
      />
    </div>
  );
}
