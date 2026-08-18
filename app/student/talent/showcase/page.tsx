import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Image as ImageIcon,
  ExternalLink,
  Heart,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

import { getCurrentDbUser } from "@/lib/clerk";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShowcaseEditor } from "@/components/talent/showcase-editor";

import { listShowcaseItemsAction } from "@/server/actions/talent";

/**
 * §10.4 — Public Showcase editor page.
 *
 * Renders the `ShowcaseEditor` (create new items) on the left and the
 * list of existing items on the right. Each item is rendered as a simple
 * card showing the title, description, type, publication status, like
 * count and creation date.
 */
export default async function ShowcasePage() {
  const user = await getCurrentDbUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "student") redirect("/dashboard");

  const tNav = await getTranslations("Navigation");

  const itemsRes = await listShowcaseItemsAction();
  const items = itemsRes.success ? itemsRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNav("showcase")}
        description={tNav("showcaseDescription")}
        icon={<ImageIcon className="size-6" />}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: editor */}
        <div className="lg:col-span-5">
          <ShowcaseEditor />
        </div>

        {/* Right: list of items */}
        <div className="space-y-4 lg:col-span-7">
          <SectionCard
            title={tNav("showcaseItems")}
            icon={<Sparkles className="size-4" />}
          >
            {items.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title={tNav("showcaseEmpty")}
                description={tNav("showcaseEmptyHint")}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <Card key={item.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-sm font-semibold">
                        {item.title}
                      </h3>
                      <Badge variant="outline" className="capitalize">
                        {item.type}
                      </Badge>
                    </div>

                    {item.description && (
                      <p className="line-clamp-3 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {item.isPublished ? (
                          <>
                            <Eye className="size-3 text-emerald-600 dark:text-emerald-400" />
                            Published
                          </>
                        ) : (
                          <>
                            <EyeOff className="size-3" />
                            Draft
                          </>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="size-3" />
                        {item.likesCount}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    {item.externalUrl && (
                      <Link
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
                      >
                        <ExternalLink className="size-3" />
                        {item.externalUrl}
                      </Link>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
