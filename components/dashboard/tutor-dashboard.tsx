"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  DollarSign,
  MessageSquare,
  Star,
  Users,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useUserStore } from "@/stores/user-store";
import { useTranslations } from "next-intl";

type Props = {};

export default function TutorDashboard({}: Props) {
  const user = useUserStore((s) => s.user);
  if (!user) return null;

  const t = useTranslations("Dashboard");

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("welcome", { name: user.firstName ?? user.email })}
          description={t("today")}
          icon={<Sparkles className="size-6" />}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Réservations à venir"
            value="—"
            icon={CalendarClock}
            accent="primary"
          />
          <StatCard
            label="Revenus du mois"
            value="—"
            icon={DollarSign}
            accent="emerald"
          />
          <StatCard label="Note moyenne" value="—" icon={Star} accent="amber" />
          <StatCard
            label="Avis reçus"
            value="—"
            icon={MessageSquare}
            accent="blue"
          />
        </div>
        <SectionCard title="Profil tuteur" icon={<Users className="size-5" />}>
          <p className="text-sm text-muted-foreground">
            Complétez votre profil pour attirer plus d&apos;élèves.
          </p>
          <Button asChild variant="brand" size="sm" className="mt-3">
            <Link href="/profile">Compléter le profil</Link>
          </Button>
        </SectionCard>
      </div>
    </>
  );
}
