import { PageHeader } from "@/components/shared/page-header";
import { ChildrenList } from "@/components/parent/children-list";
import { Baby } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * §5.14 — Parent children list page.
 *
 * Lists every student linked to the current parent. Allows linking
 * a new child via the dialog.
 */
export default async function ChildrenPage() {
  const t = await getTranslations("Parent");
  const tNav = await getTranslations("Navigation");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={tNav("children")}
          description={t("myChildrenDescription")}
          icon={<Baby className="size-6" />}
        />
        <ChildrenList />
      </div>
    </>
  );
}
