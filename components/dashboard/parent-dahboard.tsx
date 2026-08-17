"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Baby,
  ClipboardList,
  CreditCard,
  MessageSquare,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useUserStore } from "@/stores/user-store";

export default function ParentDashboard() {
  const user = useUserStore((s) => s.user);

  const t = useTranslations("Dashboard");

  if (!user) return null;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t("welcome", { name: user.firstName ?? user.email })}
          description={t("today")}
          icon={<Baby className="size-6" />}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Enfants liés"
            value="—"
            icon={Baby}
            accent="primary"
            hint="Gérez vos enfants"
          />
          <StatCard
            label="Devoirs en retard"
            value="—"
            icon={ClipboardList}
            accent="rose"
          />
          <StatCard
            label="Messages non lus"
            value="—"
            icon={MessageSquare}
            accent="blue"
          />
          <StatCard
            label="Paiements"
            value="—"
            icon={CreditCard}
            accent="emerald"
          />
        </div>
        <SectionCard
          title="Actions rapides"
          icon={<Sparkles className="size-5" />}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button asChild variant="brand-outline" className="justify-start">
              <Link href="/children">
                <Baby className="size-4" /> Mes enfants
              </Link>
            </Button>
            <Button asChild variant="brand-outline" className="justify-start">
              <Link href="/billing">
                <CreditCard className="size-4" /> Facturation
              </Link>
            </Button>
            <Button asChild variant="brand-outline" className="justify-start">
              <Link href="/messages">
                <MessageSquare className="size-4" /> Messages
              </Link>
            </Button>
          </div>
        </SectionCard>
        <SectionCard
          title="Suivi de vos enfants"
          description="Les rapports de progression apparaîtront ici"
          icon={<TrendingUp className="size-5" />}
        >
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Liez votre compte à celui de votre enfant pour suivre sa
            progression.
          </Card>
        </SectionCard>
      </div>
    </>
  );
}
