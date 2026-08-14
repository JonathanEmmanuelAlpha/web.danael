import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import {
  TeacherQuestionsValidation,
  GenerateQuestionsButton,
} from "@/components/quiz/teacher-questions-validation";

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

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
          icon={<ShieldCheck className="size-6" />}
          actions={<GenerateQuestionsButton />}
        />
        <TeacherQuestionsValidation teacherId={user.id} />
      </div>
    </DashboardShell>
  );
}
