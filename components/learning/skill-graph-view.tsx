"use client";

/**
 * Skill graph view — collapsible tree + detail panel.
 *
 * Phase 1: shows the skill tree (nested Accordion-like rows).
 * Phase 2: each node shows a mastery bar color-coded by level:
 *   - < 40%   : coral (accent-coral-400)
 *   - 40-70%  : amber (accent-amber-400)
 *   - > 70%   : primary-500 (lime green)
 * Phase 3: clicking a skill opens a detail panel with:
 *   - Mastery history mini-chart (MasteryChart, inline mode)
 *   - Projection ("À ce rythme, tu maîtriseras dans X jours")
 *   - Peer signals ("Les élèves qui ont du mal avec X ont trouvé Y utile")
 *   - Recommended resources (peer signals list)
 *
 * Glass-card surface per skill node. Aurora Navy.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Lightbulb,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MasteryChart, type MasteryChartPoint } from "./mastery-chart";
import {
  getMasteryHistoryAction,
  getPeerSignalsAction,
  projectMasteryAction,
} from "@/server/actions/learning";
import type { SkillNodeWithState } from "@/server/services/learning";

/* -- Mastery helpers ------------------------------------------ */

type MasteryLevel = "low" | "medium" | "high";

function masteryLevel(mastery: number): MasteryLevel {
  if (mastery < 40) return "low";
  if (mastery < 70) return "medium";
  return "high";
}

function masteryColor(level: MasteryLevel): string {
  switch (level) {
    case "low":
      return "bg-accent-coral-400";
    case "medium":
      return "bg-accent-amber-400";
    case "high":
      return "bg-primary-500";
  }
}

function masteryText(level: MasteryLevel, t: (k: string) => string): string {
  return t(`masteryLevel.${level}`);
}

function masteryBadgeVariant(
  level: MasteryLevel,
): "destructive" | "warning" | "success" {
  switch (level) {
    case "low":
      return "destructive";
    case "medium":
      return "warning";
    case "high":
      return "success";
  }
}

function formatLastPracticed(
  iso: string | null,
  t: (k: string) => string,
): string {
  if (!iso) return t("skillNeverPracticed");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t("skillNeverPracticed");
  const diffDays = Math.floor(
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 0) return t("skillLastPracticed") + " · aujourd'hui";
  if (diffDays === 1) return t("skillLastPracticed") + " · hier";
  return `${t("skillLastPracticed")} · ${diffDays}j`;
}

/* -- Detail panel --------------------------------------------- */

interface SkillDetailState {
  loading: boolean;
  history: MasteryChartPoint[];
  projection: {
    daysToTarget: number;
    projectedDate: string;
    confidence: number;
  } | null;
  peerSignals: {
    resourceId: string;
    resourceType: string;
    helpfulCount: number;
    avgImprovement: number;
  }[];
}

function SkillDetailPanel({ skill }: { skill: SkillNodeWithState }) {
  const t = useTranslations("Learning");
  const [state, setState] = React.useState<SkillDetailState>({
    loading: true,
    history: [],
    projection: null,
    peerSignals: [],
  });

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMasteryHistoryAction({ skillId: skill.id, days: 30 }),
      projectMasteryAction({ skillId: skill.id, targetMastery: 80 }),
      getPeerSignalsAction({ skillId: skill.id }),
    ])
      .then(([histRes, projRes, peerRes]) => {
        if (cancelled) return;
        setState({
          loading: false,
          history:
            histRes.success && histRes.data
              ? histRes.data.map((h) => ({
                  date: h.recordedAt.toISOString(),
                  mastery: h.mastery,
                }))
              : [],
          projection:
            projRes.success && projRes.data
              ? {
                  daysToTarget: projRes.data.daysToTarget,
                  projectedDate: projRes.data.projectedDate,
                  confidence: projRes.data.confidence,
                }
              : null,
          peerSignals:
            peerRes.success && peerRes.data
              ? peerRes.data.map((p) => ({
                  resourceId: p.resourceId,
                  resourceType: p.resourceType,
                  helpfulCount: p.helpfulCount,
                  avgImprovement: p.avgImprovement,
                }))
              : [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [skill.id]);

  const level = masteryLevel(skill.mastery);

  return (
    <div className="mt-2 space-y-4 rounded-lg border border-border bg-white/[0.02] p-4 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock
          icon={Target}
          label={t("mastery")}
          value={`${Math.round(skill.mastery)}%`}
        />
        <StatBlock
          icon={TrendingUp}
          label={t("skillPredicted")}
          value={`${Math.round(skill.predictedMastery)}%`}
        />
        <StatBlock
          icon={Users}
          label={t("skillPractice")}
          value={`${skill.practiceCount}`}
        />
        <StatBlock
          icon={Clock}
          label={t("skillTrend")}
          value={
            skill.trend >= 0
              ? `+${skill.trend.toFixed(1)}`
              : skill.trend.toFixed(1)
          }
          trend={skill.trend}
        />
      </div>

      {/* Mastery history mini-chart */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <TrendingUp className="size-3.5 text-primary-400" />
          {t("mastery")}
        </div>
        <MasteryChart
          data={state.history}
          loading={state.loading}
          withCard={false}
          height="120px"
        />
      </div>

      {/* Projection */}
      {state.projection && (
        <div className="rounded-md border border-border bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Target className="size-3.5 text-accent-cyan-400" />
              {t("projection")}
            </div>
            <Badge
              variant={
                state.projection.confidence >= 0.7
                  ? "success"
                  : state.projection.confidence >= 0.4
                    ? "warning"
                    : "secondary"
              }
              size="sm"
            >
              {state.projection.confidence >= 0.7
                ? t("projectionConfidenceHigh")
                : state.projection.confidence >= 0.4
                  ? t("projectionConfidenceMedium")
                  : t("projectionConfidenceLow")}
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {skill.mastery >= 80 ? (
              t("projectionReached")
            ) : (
              <>
                <span className="font-mono font-semibold text-foreground">
                  ~{state.projection.daysToTarget}
                </span>{" "}
                {t("daysToMastery")} ·{" "}
                {new Date(state.projection.projectedDate).toLocaleDateString(
                  undefined,
                  { day: "numeric", month: "short" },
                )}
              </>
            )}
          </p>
        </div>
      )}

      {/* Peer signals */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Lightbulb className="size-3.5 text-accent-amber-400" />
          {t("peerSignal")}
        </div>
        {state.loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ) : state.peerSignals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("peerSignalNoData")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {state.peerSignals.slice(0, 3).map((s) => (
              <li
                key={s.resourceId}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-white/[0.02] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="violet" size="sm">
                    {s.resourceType}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {s.resourceId.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Users className="size-3" />
                    {s.helpfulCount}
                  </span>
                  <span className="flex items-center gap-0.5 text-primary-400">
                    <TrendingUp className="size-3" />+
                    {s.avgImprovement.toFixed(1)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {masteryText(level, t)} ·{" "}
        {formatLastPracticed(skill.lastPracticedAt, t)}
      </p>
    </div>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: number;
}) {
  return (
    <div className="rounded-md border border-border bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-sm font-semibold",
          trend !== undefined && trend >= 0
            ? "text-primary-400"
            : trend !== undefined
              ? "text-accent-coral-400"
              : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* -- Skill node row ------------------------------------------- */

interface SkillNodeRowProps {
  node: SkillNodeWithState;
  depth: number;
  expandedSet: Set<string>;
  selectedId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}

function SkillNodeRow({
  node,
  depth,
  expandedSet,
  selectedId,
  onToggleExpand,
  onSelect,
}: SkillNodeRowProps) {
  const t = useTranslations("Learning");
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedSet.has(node.id);
  const isSelected = selectedId === node.id;
  const level = masteryLevel(node.mastery);

  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div
        className={cn(
          "glass-card group relative overflow-hidden rounded-lg transition-all",
          "hover:-translate-y-0.5 hover:border-border-strong",
          isSelected && "border-primary-500/50 glow-primary-sm",
        )}
      >
        {/* Top-edge mastery-color accent */}
        <div
          aria-hidden
          className={cn("absolute inset-x-0 top-0 h-0.5", masteryColor(level))}
        />
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex w-full items-center gap-2 p-3 text-left"
        >
          {/* Expand toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.id);
              }}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-surface-3 hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          ) : (
            <span className="size-6 shrink-0" aria-hidden />
          )}

          {/* Name + code */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {node.name}
              </span>
              <Badge variant={masteryBadgeVariant(level)} size="sm">
                {masteryText(level, t)}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {node.code}
            </span>
          </div>

          {/* Mastery bar */}
          <div className="hidden w-32 shrink-0 sm:block">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t("mastery")}</span>
              <span className="font-mono">{Math.round(node.mastery)}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  masteryColor(level),
                )}
                style={{ width: `${node.mastery}%` }}
              />
            </div>
          </div>
        </button>

        {/* Selected detail panel */}
        {isSelected && (
          <div className="px-3 pb-3">
            <SkillDetailPanel skill={node} />
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {node.children.map((child) => (
            <SkillNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedSet={expandedSet}
              selectedId={selectedId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Main component ------------------------------------------- */

export interface SkillGraphViewProps {
  skills: SkillNodeWithState[];
  loading?: boolean;
  className?: string;
}

export function SkillGraphView({
  skills,
  loading = false,
  className,
}: SkillGraphViewProps) {
  const t = useTranslations("Learning");
  const [expandedSet, setExpandedSet] = React.useState<Set<string>>(
    () => new Set(skills.map((s) => s.id)),
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Note: we intentionally do NOT reset expandedSet when `skills` changes
  // — the lazy initializer above runs once on mount, and the parent passes
  // server-fetched data that is stable for the component's lifetime.

  const handleToggleExpand = (id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <Card
      className={cn("relative overflow-hidden p-5 animate-fade-up", className)}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/40 via-accent-cyan-400/20 to-transparent"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="glass flex size-9 shrink-0 items-center justify-center rounded-lg text-primary-400 glow-primary-sm">
            <Target className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {t("skillGraph")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("skillGraphHint")}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
        {loading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="glass flex size-12 items-center justify-center rounded-xl text-muted-foreground">
              <AlertCircle className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("skillGraphHint")}
            </p>
            <Button asChild variant="brand-outline" size="sm">
              <a href="/learning/diagnostic">{t("startDiagnostic")}</a>
            </Button>
          </div>
        ) : (
          skills.map((node) => (
            <SkillNodeRow
              key={node.id}
              node={node}
              depth={0}
              expandedSet={expandedSet}
              selectedId={selectedId}
              onToggleExpand={handleToggleExpand}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </Card>
  );
}
