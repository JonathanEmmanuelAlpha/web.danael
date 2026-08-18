"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  User as UserIcon,
  Star,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  respondMentorRecommendationAction,
} from "@/server/actions/talent";
import type { MentorRecommendationWithTutor } from "@/server/services/talent-mentor";

export interface MentorRecommendationCardProps {
  reco: MentorRecommendationWithTutor;
  onResponded?: () => void;
}

export function MentorRecommendationCard({
  reco,
  onResponded,
}: MentorRecommendationCardProps) {
  const t = useTranslations("Talent");
  const matchPct = Math.round(reco.matchScore * 100);

  const fullName =
    [reco.tutor.firstName, reco.tutor.lastName]
      .filter(Boolean)
      .join(" ") || reco.tutor.email;

  async function handleRespond(status: "accepted" | "rejected") {
    const res = await respondMentorRecommendationAction({
      recommendationId: reco.id,
      status,
    });
    if (res.success) {
      toast.success(
        status === "accepted" ? t("mentorAccepted") : t("mentorRejected"),
      );
      onResponded?.();
    } else {
      toast.error(res.error?.message ?? t("mentorRespondFailed"));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent p-5">
        <div className="flex items-start gap-3">
          <Avatar className="size-12">
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white">
              {fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold">
                {fullName}
              </h3>
              {reco.status === "accepted" && (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  {t("accepted")}
                </Badge>
              )}
              {reco.status === "rejected" && (
                <Badge variant="outline" className="text-muted-foreground">
                  <XCircle className="size-3" />
                  {t("rejected")}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {reco.reason}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Sparkles className="size-3" />
                {matchPct}% {t("match")}
              </span>
              {reco.skill && (
                <Badge variant="outline" className="text-[10px]">
                  {reco.skill.name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {reco.status === "suggested" && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="brand"
              size="sm"
              className="flex-1"
              onClick={() => handleRespond("accepted")}
            >
              <CheckCircle2 className="size-3.5" />
              {t("accept")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRespond("rejected")}
            >
              {t("decline")}
            </Button>
          </div>
        )}

        {reco.status === "accepted" && (
          <div className="mt-4">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href={`/tutors/${reco.tutor.id}`}>
                <UserIcon className="size-3.5" />
                {t("viewProfile")}
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
