"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Users,
  Sparkles,
  CheckCircle2,
  Plus,
  LogOut,
  Target,
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  joinCohortAction,
  leaveCohortAction,
} from "@/server/actions/talent";

export interface CohortCardProps {
  cohort: {
    id: string;
    name: string;
    icon: string | null;
    level: string | null;
    skillId: string;
    isActive: boolean;
  };
  isMember: boolean;
  memberCount: number;
  onChanged?: () => void;
}

export function CohortCard({
  cohort,
  isMember,
  memberCount,
  onChanged,
}: CohortCardProps) {
  const t = useTranslations("Talent");

  async function handleJoin() {
    const res = await joinCohortAction({ cohortId: cohort.id });
    if (res.success) {
      toast.success(t("joinedCohort"));
      onChanged?.();
    } else {
      toast.error(res.error?.message ?? t("joinFailed"));
    }
  }

  async function handleLeave() {
    const res = await leaveCohortAction({ cohortId: cohort.id });
    if (res.success) {
      toast.success(t("leftCohort"));
      onChanged?.();
    } else {
      toast.error(res.error?.message ?? t("leaveFailed"));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent p-5 transition-all hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-2xl">
            {cohort.icon ?? "🎯"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold">
                {cohort.name}
              </h3>
              {isMember && (
                <Badge
                  variant="secondary"
                  className="bg-purple-500/10 text-purple-700 dark:text-purple-300"
                >
                  <CheckCircle2 className="size-3" />
                  {t("member")}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {memberCount} {t("members")}
              </span>
              {cohort.level && (
                <Badge variant="outline" className="text-[10px]">
                  {cohort.level}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {isMember ? (
            <>
              <Button variant="outline" size="sm" asChild className="flex-1">
                <Link href={`/student/talent/cohorts/${cohort.id}`}>
                  <Target className="size-3.5" />
                  {t("viewCohort")}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeave}
                className="text-muted-foreground"
              >
                <LogOut className="size-3.5" />
              </Button>
            </>
          ) : (
            <Button
              variant="brand"
              size="sm"
              onClick={handleJoin}
              className="w-full"
            >
              <Plus className="size-3.5" />
              {t("joinCohort")}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
