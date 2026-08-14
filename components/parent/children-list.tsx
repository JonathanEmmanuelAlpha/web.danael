"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Baby, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading";
import { ChildCard } from "@/components/parent/child-card";
import { LinkChildDialog } from "@/components/parent/link-child-dialog";
import { listChildrenAction } from "@/server/actions/parent";
import type { ChildSummary } from "@/server/services/parent";

/**
 * §5.14 — Client-side list of children linked to the current parent.
 */
export function ChildrenList() {
  const t = useTranslations("Parent");
  const [items, setItems] = useState<ChildSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listChildrenAction().then((res) => {
      if (cancelled) return;
      setItems(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return <GridSkeleton count={3} columns={3} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Baby}
        title={t("noChildren")}
        description={t("noChildrenHint")}
      >
        <LinkChildDialog trigger={null} />
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LinkChildDialog />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <li key={c.id}>
            <ChildCard child={c} />
          </li>
        ))}
      </ul>
      <div className="flex justify-center pt-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="size-3.5" />
            {t("backToDashboard")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
