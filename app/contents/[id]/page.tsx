import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Library } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { ContentDetailView } from "@/components/contents/content-detail-view";
import { getContentAction } from "@/server/actions/contents";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

/**
 * §5.4 — Content detail page (student / any role).
 *
 * Shows the content metadata, inline PDF viewer (via presigned download URL),
 * favorite button, private notes, download button, and report dialog.
 */
export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const t = await getTranslations("Contents");

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

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Link
          href="/student/library"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("backToLibrary")}
        </Link>
        <PageHeader
          title={t("detailTitle")}
          description={t("detailDescription")}
          icon={<Library className="size-6" />}
        />
        <ContentDetailView content={content} canEdit={canEdit} />
      </div>
    </DashboardShell>
  );
}
