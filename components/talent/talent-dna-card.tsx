"use client";

import { useTranslations } from "next-intl";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { Sparkles, Target, TrendingUp, Award, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/* ── Types ─────────────────────────────────────────────────── */

export interface TalentDnaData {
  cognitiveScores: {
    numerical?: number;
    verbal?: number;
    spatial?: number;
    logic?: number;
    memory?: number;
  };
  domainScores: Record<string, number>;
  creativityScore: number;
  engagementScore: number;
  overallTalentScore: number;
  detectedZones: string[];
  growthZones: string[];
  northStar: { id: string; name: string; difficulty: string } | null;
  northStarTier: string;
}

const TIER_META: Record<
  string,
  { color: string; gradient: string; label: string; icon: string }
> = {
  seedling: {
    color: "text-emerald-600 dark:text-emerald-400",
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    label: "Seedling",
    icon: "🌱",
  },
  bronze: {
    color: "text-amber-700 dark:text-amber-500",
    gradient: "from-amber-600/20 via-amber-600/5 to-transparent",
    label: "Bronze",
    icon: "🥉",
  },
  silver: {
    color: "text-slate-500 dark:text-slate-300",
    gradient: "from-slate-400/20 via-slate-400/5 to-transparent",
    label: "Silver",
    icon: "🥈",
  },
  gold: {
    color: "text-yellow-600 dark:text-yellow-400",
    gradient: "from-yellow-500/20 via-yellow-500/5 to-transparent",
    label: "Gold",
    icon: "🥇",
  },
  diamond: {
    color: "text-cyan-600 dark:text-cyan-300",
    gradient: "from-cyan-400/25 via-cyan-400/5 to-transparent",
    label: "Diamond",
    icon: "💎",
  },
};

const COGNITIVE_LABELS: Record<string, string> = {
  numerical: "Numérique",
  verbal: "Verbal",
  spatial: "Spatial",
  logic: "Logique",
  memory: "Mémoire",
};

/* ── Component ─────────────────────────────────────────────── */

export interface TalentDnaCardProps {
  data: TalentDnaData;
  compact?: boolean;
}

export function TalentDnaCard({ data, compact = false }: TalentDnaCardProps) {
  const t = useTranslations("Talent");

  const radarData = Object.entries(data.cognitiveScores).map(
    ([key, value]) => ({
      domain: COGNITIVE_LABELS[key] ?? key,
      score: Math.round(value ?? 0),
    }),
  );

  const tierMeta = TIER_META[data.northStarTier] ?? TIER_META.seedling;
  const overallPct = Math.round(data.overallTalentScore * 100);

  return (
    <Card
      className={`relative overflow-hidden border-0 bg-gradient-to-br ${tierMeta.gradient} p-6`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute right-4 top-4">
          <Sparkles className="size-24 text-white/10" />
        </div>
        <div className="absolute bottom-4 left-4">
          <Target className="size-16 text-white/10" />
        </div>
      </div>

      <div className="relative space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5" />
              {t("talentDnaCard")}
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold text-foreground">
              {data.northStar ? data.northStar.name : t("noNorthStarYet")}
            </h2>
            {data.northStar && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl">{tierMeta.icon}</span>
                <Badge variant="secondary" className={`gap-1 ${tierMeta.color}`}>
                  {t(`tier.${data.northStarTier}`)}
                </Badge>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              {t("overallTalentScore")}
            </div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="font-display text-3xl font-extrabold text-foreground"
            >
              {overallPct}
              <span className="text-base text-muted-foreground">/100</span>
            </motion.div>
          </div>
        </div>

        {!compact && radarData.length > 0 && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid
                  stroke="currentColor"
                  className="text-muted-foreground/30"
                />
                <PolarAngleAxis
                  dataKey="domain"
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="Cognitive"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.detectedZones.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Star className="size-3.5" />
              {t("detectedTalents")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.detectedZones.map((zone) => (
                <Badge
                  key={zone}
                  variant="secondary"
                  className="bg-primary-500/10 text-primary-700 dark:text-primary-300"
                >
                  {zone}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {data.growthZones.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="size-3.5" />
              {t("growthZones")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.growthZones.map((zone) => (
                <Badge key={zone} variant="outline">
                  {zone}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-4 sm:grid-cols-4">
          <ScorePill
            icon={<Sparkles className="size-3.5" />}
            label={t("creativity")}
            value={Math.round(data.creativityScore)}
          />
          <ScorePill
            icon={<Award className="size-3.5" />}
            label={t("engagement")}
            value={Math.round(data.engagementScore)}
          />
        </div>
      </div>
    </Card>
  );
}

function ScorePill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      <Progress value={value} className="mt-2 h-1" />
    </div>
  );
}
