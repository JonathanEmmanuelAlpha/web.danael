"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading";
import { CompetitionCard } from "./competition-card";
import {
  listActiveCompetitionsAction,
  listMyCompetitionsAction,
} from "@/server/actions/competitions";
import type { CompetitionListItem } from "@/server/services/competitions";

export function StudentCompetitionsList({ userId }: { userId: string }) {
  const t = useTranslations("Competitions");
  const [active, setActive] = useState<CompetitionListItem[] | null>(null);
  const [mine, setMine] = useState<CompetitionListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listActiveCompetitionsAction(),
      listMyCompetitionsAction(),
    ]).then(([a, m]) => {
      if (cancelled) return;
      setActive(a.success ? a.data : []);
      setMine(m.success ? m.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <Tabs defaultValue="active" className="w-full">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="active" className="flex-1">
          {t("activeTab")}
        </TabsTrigger>
        <TabsTrigger value="mine" className="flex-1">
          {t("myCompetitions")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="mt-4">
        {active === null ? (
          <GridSkeleton count={6} columns={3} />
        ) : active.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={t("noActiveCompetitions")}
            description={t("noActiveCompetitionsHint")}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c) => (
              <li key={c.id}>
                <CompetitionCard competition={c} variant="student" />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="mine" className="mt-4">
        {mine === null ? (
          <GridSkeleton count={6} columns={3} />
        ) : mine.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={t("noJoinedCompetitions")}
            description={t("noJoinedCompetitionsHint")}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((c) => (
              <li key={c.id}>
                <CompetitionCard competition={c} variant="student" />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
