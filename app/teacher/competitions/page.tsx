import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherCompetitionsList } from "@/components/gamification/teacher-competitions-list";

/**
 * §5.7 — Teacher competitions list page.
 *
 * Lists all competitions (created by teachers + school admins) and provides a
 * "Create competition" button.
 */
export default async function TeacherCompetitionsPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const tComp = await getTranslations("Competitions");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={tComp("teacherTitle")}
          description={tComp("teacherDescription")}
          icon={<Trophy className="size-6" />}
        />
        <TeacherCompetitionsList teacherId={user.id} />
      </div>
    </>
  );
}
