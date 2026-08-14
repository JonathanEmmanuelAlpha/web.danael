import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { getCurrentDbUser } from "@/lib/clerk";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { FavoritesList } from "@/components/contents/favorites-list";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * §5.4 — User's favorited contents.
 */
export default async function FavoritesPage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");

  const t = await getTranslations("Contents");
  const role = user.role as UserRole;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  return (
    <DashboardShell role={role} userName={userName} userImage={user.avatarUrl ?? undefined}>
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
