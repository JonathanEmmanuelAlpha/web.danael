import { redirect, notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { ContentForm } from "@/components/contents/content-form";
import { getContentAction } from "@/server/actions/contents";
import { listSubjectsAction } from "@/server/actions/subjects";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";
import type { Subject } from "@/server/db/schema/schools";

export const dynamic = "force-dynamic";

/**
 * §5.4 — Edit an existing content (uploader / admin / moderator).
 *
 * Routes:
 *  - /contents/[id]/edit (teachers via the nav "contents" link)
 */
export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const t = await getTranslations("Contents");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  const res = await getContentAction(id);
  if (!res.success) {
    if (res.error.code === "NOT_FOUND") notFound();
    throw new Error(res.error.message);
  }

  const content = res.data;
  const canEdit =
    content.uploadedBy === user.id ||
    user.role === "platform_admin" ||
    user.role === "content_moderator";

  if (!canEdit) {
    redirect(`/contents/${id}`);
  }

  const subjectsRes = await listSubjectsAction();
  const subjects: Subject[] = subjectsRes.success ? subjectsRes.data : [];

  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          title={t("editContent")}
          description={t("editContentDescription")}
          icon={<Pencil className="size-6" />}
        />
        <div className="mx-auto max-w-3xl">
          <ContentForm subjects={subjects} initialContent={content} />
        </div>
      </div>
    </DashboardShell>
  );
}
