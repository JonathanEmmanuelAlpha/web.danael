import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, FolderOpen } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TeacherContentsList } from "@/components/contents/teacher-contents-list";
import { getTranslations } from "next-intl/server";
import { hasPermission } from "@/server/permissions";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * §5.4 — Contents management page.
 *
 * Resolves to `/contents` (used by both teachers and school_admins).
 *
 * - Teacher / school_admin / platform_admin / content_moderator: shows the
 *   "My contents" management list with upload / edit / delete actions.
 * - Other roles (student, parent, tutor): redirect to `/library` (the public
 *   catalog browse page).
 */
export default async function ContentsPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const t = await getTranslations("Contents");
  const role = user.role as UserRole;

  // Students / parents / tutors browse the catalog instead.
  if (!hasPermission(role, "content:create")) {
    redirect("/library");
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("myContentsTitle")}
          description={t("myContentsDescription")}
          icon={<FolderOpen className="size-6" />}
          actions={
            <Button asChild variant="brand">
              <Link href="/teacher/contents/new">
                <Plus className="size-4" />
                {t("upload")}
              </Link>
            </Button>
          }
        />
        <TeacherContentsList teacherId={user.id} />
      </div>
    </>
  );
}
