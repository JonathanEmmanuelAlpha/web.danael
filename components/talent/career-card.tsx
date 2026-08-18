"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Briefcase,
  Star,
  Bookmark,
  BookmarkCheck,
  TrendingUp,
  GraduationCap,
  DollarSign,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { bookmarkCareerAction } from "@/server/actions/talent";
import type { CareerMatch } from "@/server/db/schema/talent";

export interface CareerCardProps {
  career: CareerMatch;
  onBookmark?: () => void;
}

export function CareerCard({ career, onBookmark }: CareerCardProps) {
  const t = useTranslations("Talent");
  const matchPct = Math.round(career.matchScore * 100);

  async function handleBookmark() {
    const res = await bookmarkCareerAction({
      careerMatchId: career.id,
      isBookmarked: !career.isBookmarked,
    });
    if (res.success) {
      toast.success(
        career.isBookmarked ? t("careerRemoved") : t("careerBookmarked"),
      );
      onBookmark?.();
    } else {
      toast.error(res.error?.message ?? t("bookmarkFailed"));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-5 transition-all hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Briefcase className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold">
                  {career.careerTitle}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {career.careerCode}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBookmark}
            aria-label={t("bookmark")}
          >
            {career.isBookmarked ? (
              <BookmarkCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Bookmark className="size-4" />
            )}
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{career.reason}</p>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="size-3" />
              {t("matchScore")}
            </span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {matchPct}%
            </span>
          </div>
          <Progress
            value={matchPct}
            className="h-1.5 bg-emerald-500/10"
          />
        </div>

        {career.skillId && (
          <div className="mt-3">
            <Badge variant="outline" className="text-[10px]">
              <Star className="size-3" />
              {t("viaTalent")}
            </Badge>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
