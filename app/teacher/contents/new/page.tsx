import { Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ContentForm } from "@/components/contents/content-form";
import { listSubjectsAction } from "@/server/actions/subjects";
import { getTranslations } from "next-intl/server";
import type { Subject } from "@/server/db/schema/schools";

export const dynamic = "force-dynamic";

/**
 * §5.4 — Upload new content (teacher / school_admin / platform_admin).
 */
export default async function NewContentPage() {
  const t = await getTranslations("Contents");

  const subjectsRes = await listSubjectsAction();
  const subjects: Subject[] = subjectsRes.success ? subjectsRes.data : [];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("newContent")}
          description={t("newContentDescription")}
          icon={<Upload className="size-6" />}
        />
        <div className="mx-auto max-w-3xl">
          <ContentForm subjects={subjects} />
        </div>
      </div>
    </>
  );
}
