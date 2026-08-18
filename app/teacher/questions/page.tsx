import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { TeacherQuestionsValidation } from "@/components/quiz/teacher-questions-validation";
import { AiGenerateDialog } from "@/components/quiz/ai-generate-dialog";
import { listSubjectsForFilterAction } from "@/server/actions/ai-questions";

/**
 * §10.4 — Teacher page for validating AI-generated questions.
 *
 * Only `teacher`, `school_admin`, and `platform_admin` can access this.
 * The (teacher) route group is a Server Component wrapper — the validation UI
 * itself is a Client Component fetching via server actions.
 */
export default async function TeacherQuestionsPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const t = await getTranslations("AiQuestions");

  const subjectsRes = await listSubjectsForFilterAction();
  const subjects = subjectsRes.success ? subjectsRes.data : [];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
          icon={<ShieldCheck className="size-6" />}
          actions={<AiGenerateDialog subjects={subjects} />}
        />
        <TeacherQuestionsValidation teacherId={user.id} subjects={subjects} />
      </div>
    </>
  );
}
