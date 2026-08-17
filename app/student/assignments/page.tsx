import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * §5.5 — Student assignments list.
 * Lists all assignments the student needs to complete (with submission status).
 */
export default async function StudentAssignmentsPage() {
  const t = await getTranslations("Navigation");

  return (
    <>
      <PageHeader
        title={t("assignments")}
        description="Vos devoirs à rendre"
        icon={<ClipboardList className="size-6" />}
      />
      <EmptyState
        icon={ClipboardList}
        title="Aucun devoir à faire"
        description="Les devoirs assignés par vos enseignants apparaîtront ici. Rejoignez une classe pour commencer."
      />
    </>
  );
}
