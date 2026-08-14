import { Heart } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { FavoritesList } from "@/components/contents/favorites-list";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

/**
 * §5.4 — User's favorited contents.
 */
export default async function FavoritesPage() {
  const t = await getTranslations("Contents");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={t("favoritesTitle")}
          description={t("favoritesDescription")}
          icon={<Heart className="size-6" />}
        />
        <FavoritesList />
      </div>
    </DashboardShell>
  );
}
