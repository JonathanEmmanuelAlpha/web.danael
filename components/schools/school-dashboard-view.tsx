"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, School as SchoolIcon } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageLoader } from "@/components/shared/loading";
import { CreateSchoolForm } from "@/components/schools/create-school-form";
import { getMySchoolAction } from "@/server/actions/schools";
import type { SchoolWithCounts } from "@/server/services/schools";
import type { User } from "@/server/db/schema/users";

interface SchoolDashboardViewProps {
  user: Pick<User, "firstName" | "lastName" | "avatarUrl" | "role">;
}

/**
 * §5.3 — School admin dashboard view.
 *
 * If the user has no school yet, shows the create-school form.
 * Otherwise shows the school overview (stats + quick actions).
 */
export function SchoolDashboardView({ user }: SchoolDashboardViewProps) {
  const t = useTranslations("Schools");
  const router = useRouter();
  const [school, setSchool] = useState<SchoolWithCounts | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    getMySchoolAction().then((res) => {
      if (cancelled) return;
      if (res.success) setSchool(res.data);
      else {
        toast.error(res.error?.message ?? t("noSchool"));
        setSchool(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (school === undefined) {
    return (
      <DashboardShell>
        <PageLoader />
      </DashboardShell>
    );
  }

  if (!school) {
    return (
      <DashboardShell>
        <CreateSchoolForm
          onCreated={(s) => {
            setSchool(s);
            router.push("/dashboard");
            router.refresh();
          }}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <SchoolOverview school={school} />
    </DashboardShell>
  );
}

/* ── Overview ───────────────────────────────────────────── */

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  GraduationCap,
  School as SchoolIcon2,
  Users,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

function SchoolOverview({ school }: { school: SchoolWithCounts }) {
  const t = useTranslations("Schools");
  const tNav = useTranslations("Navigation");

  return (
    <div className="space-y-6">
      <PageHeader
        title={school.name}
        description={t("overview")}
        icon={<SchoolIcon className="size-6" />}
        actions={
          school.isVerified ? (
            <Badge variant="success" size="lg">
              {t("verified")}
            </Badge>
          ) : (
            <Badge variant="warning" size="lg">
              {t("notVerified")}
            </Badge>
          )
        }
      />

      {school.city && (
        <p className="text-sm text-muted-foreground">
          {school.city}
          {school.region ? `, ${school.region}` : ""}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("stats.teachers")}
          value={school.teachersCount}
          icon={GraduationCap}
          accent="primary"
        />
        <StatCard
          label={t("stats.students")}
          value={school.studentsCount}
          icon={Users}
          accent="emerald"
        />
        <StatCard
          label={t("stats.classes")}
          value={school.classesCount}
          icon={SchoolIcon2}
          accent="amber"
        />
        <StatCard
          label={t("stats.contents")}
          value={"—"}
          icon={BookOpen}
          accent="blue"
          hint={t("comingSoon")}
        />
      </div>

      <Card className="p-5">
        <h2 className="font-display text-base font-semibold text-foreground">
          {t("recentMembers")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("noMembersHint")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="brand-outline" size="sm">
            <Link href="/teachers">
              <GraduationCap className="size-4" />
              {tNav("teachers")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button asChild variant="brand-outline" size="sm">
            <Link href="/students">
              <Users className="size-4" />
              {tNav("students")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button asChild variant="brand-outline" size="sm">
            <Link href="/classes">
              <SchoolIcon2 className="size-4" />
              {tNav("classes")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Suppress unused import warning.
void Loader2;
