"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lock,
  CheckCircle2,
  Star,
  Circle,
  GitBranch,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TalentTreeNode {
  id: string;
  name: string;
  description?: string;
  tier: string;
  talentScore: number;
  mastery: number;
  isUnlocked: boolean;
  isNorthStar: boolean;
  children: TalentTreeNode[];
}

const TIER_COLORS: Record<string, string> = {
  seedling: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  bronze: "from-amber-600/20 to-amber-600/5 border-amber-600/30",
  silver: "from-slate-400/20 to-slate-400/5 border-slate-400/30",
  gold: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
  diamond: "from-cyan-400/20 to-cyan-400/5 border-cyan-400/30",
};

const TIER_ICONS: Record<string, string> = {
  seedling: "🌱",
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  diamond: "💎",
};

export interface TalentTreeProps {
  nodes: TalentTreeNode[];
}

export function TalentTree({ nodes }: TalentTreeProps) {
  const t = useTranslations("Talent");

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-6 text-white">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute left-1/4 top-1/4 size-32 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 size-32 rounded-full bg-cyan-500/30 blur-3xl" />
      </div>

      <div className="relative">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60">
              <GitBranch className="size-3.5" />
              {t("talentTree")}
            </div>
            <h2 className="mt-1 font-display text-xl font-bold">
              {t("talentTreeTitle")}
            </h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/student/talent/challenges">
              <Sparkles className="size-4" />
              {t("browseChallenges")}
            </Link>
          </Button>
        </div>

        <div className="space-y-3">
          {nodes.map((node, idx) => (
            <TalentTreeNodeItem key={node.id} node={node} depth={0} index={idx} />
          ))}
        </div>

        {nodes.length === 0 && (
          <div className="py-12 text-center text-white/60">
            <Circle className="mx-auto size-12 opacity-40" />
            <p className="mt-3 text-sm">{t("talentTreeEmpty")}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function TalentTreeNodeItem({
  node,
  depth,
  index,
}: {
  node: TalentTreeNode;
  depth: number;
  index: number;
}) {
  const t = useTranslations("Talent");
  const tierColor = TIER_COLORS[node.tier] ?? TIER_COLORS.seedling;
  const tierIcon = TIER_ICONS[node.tier] ?? "🎯";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: depth * 0.1 + index * 0.05 }}
      style={{ marginLeft: depth * 24 }}
    >
      <div
        className={`flex items-center gap-3 rounded-xl border bg-gradient-to-br ${tierColor} p-3 backdrop-blur`}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <span className="text-lg">{tierIcon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{node.name}</p>
            {node.isNorthStar && (
              <Badge
                variant="secondary"
                className="bg-yellow-500/20 text-yellow-200"
              >
                <Star className="size-3" />
                {t("northStar")}
              </Badge>
            )}
          </div>
          {node.description && (
            <p className="truncate text-xs text-white/60">{node.description}</p>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
            <span>
              {t("score")}: {Math.round(node.talentScore * 100)}%
            </span>
            <span>·</span>
            <span>
              {t("mastery")}: {Math.round(node.mastery)}%
            </span>
          </div>
        </div>
        <div className="shrink-0">
          {node.isUnlocked ? (
            <Link href={`/student/talent/challenges?skillId=${node.id}`}>
              <Button variant="ghost" size="sm" className="text-white">
                <ChevronRight className="size-4" />
              </Button>
            </Link>
          ) : (
            <Lock className="size-4 text-white/40" />
          )}
        </div>
      </div>

      {node.children.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-white/10 pl-4">
          {node.children.map((child, i) => (
            <TalentTreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              index={i}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
