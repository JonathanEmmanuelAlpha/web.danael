"use client";

/**
 * Mastery history line chart (Recharts) — Aurora Navy.
 *
 * Shows the evolution of a single skill's mastery (0-100%) over time as
 * an area-style line chart with a primary-500 stroke, a lime → transparent
 * gradient fill, and a subtle neon glow on the line.
 *
 * The chart reuses the shared `ChartContainer` wrapper (glass-card surface)
 * and shadcn `ChartContainer` + `ChartTooltip` for theming.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer as ShadcnChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartContainer } from "@/components/charts/chart-container";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { TrendingUp } from "lucide-react";

export interface MasteryChartPoint {
  /** ISO date string (or already-formatted short label). */
  date: string;
  /** Mastery value 0-100. */
  mastery: number;
}

export interface MasteryChartProps {
  /** Chart points (already ordered chronologically). */
  data: MasteryChartPoint[];
  /** Optional title; defaults to the i18n "mastery" key. */
  title?: string;
  description?: string;
  /** Render a shimmering skeleton when true. */
  loading?: boolean;
  /** Chart height (CSS). Default "180px". */
  height?: string;
  className?: string;
  /** Whether to render the wrapper card chrome. Default true. */
  withCard?: boolean;
}

/** Primary lime stroke + rgba glow for the area drop-shadow. */
const STROKE = "#93d91a"; // chart-1 lime
const GLOW = "rgba(147,217,26,0.5)";

function formatDateLabel(iso: string): string {
  // Accept either an ISO date or an already-formatted short label.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function MasteryChart({
  data,
  title,
  description,
  loading = false,
  height = "180px",
  className,
  withCard = true,
}: MasteryChartProps) {
  const t = useTranslations("Learning");

  const chartData = React.useMemo(
    () =>
      data.map((p) => ({
        date: formatDateLabel(p.date),
        mastery: p.mastery,
      })),
    [data],
  );

  const config: ChartConfig = React.useMemo(
    () => ({
      mastery: { label: t("mastery"), color: STROKE },
    }),
    [t],
  );

  const hasData = chartData.length > 0;

  // Inline (no card chrome) variant — used inside the skill detail panel.
  if (!withCard) {
    if (loading) {
      return <Skeleton className="w-full rounded-md" style={{ height }} />;
    }
    if (!hasData) {
      return (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height }}
        >
          {t("skillNoHistory")}
        </div>
      );
    }
    return (
      <ShadcnChartContainer
        config={config}
        style={{ height }}
        className="w-full"
      >
        <RechartsAreaChart
          data={chartData}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id="masteryArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={STROKE} stopOpacity={0.4} />
              <stop offset="95%" stopColor={STROKE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            minTickGap={16}
            stroke="rgba(255,255,255,0.3)"
            fontSize={11}
          />
          <YAxis
            width={28}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            allowDecimals={false}
            domain={[0, 100]}
            stroke="rgba(255,255,255,0.3)"
            fontSize={11}
          />
          <ChartTooltip
            cursor={{
              stroke: "rgba(147,217,26,0.3)",
              strokeWidth: 1,
              strokeDasharray: "3 3",
            }}
            content={({
              active,
              payload,
              label,
              accessibilityLayer,
              activeIndex,
              coordinate,
            }) => (
              <ChartTooltipContent
                active={active}
                payload={payload}
                label={label}
                indicator="dot"
                accessibilityLayer={accessibilityLayer}
                activeIndex={activeIndex}
                coordinate={coordinate}
              />
            )}
          />
          <Area
            dataKey="mastery"
            type="monotone"
            stroke={STROKE}
            fill="url(#masteryArea)"
            fillOpacity={1}
            strokeWidth={3}
            name={t("mastery")}
            dot={{ r: 2.5, fill: STROKE, stroke: STROKE, strokeWidth: 0 }}
            activeDot={{
              r: 5,
              fill: STROKE,
              stroke: "rgba(3,9,19,0.95)",
              strokeWidth: 2,
            }}
            style={{ filter: `drop-shadow(0 0 6px ${GLOW})` }}
          />
        </RechartsAreaChart>
      </ShadcnChartContainer>
    );
  }

  // Full glass-card variant (used on the main learning page).
  return (
    <ChartContainer
      title={title ?? t("mastery")}
      description={description}
      loading={loading}
      height={height}
      className={className}
    >
      {hasData ? (
        <ShadcnChartContainer
          config={config}
          style={{ height }}
          className="w-full"
        >
          <RechartsAreaChart
            data={chartData}
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="masteryAreaCard" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STROKE} stopOpacity={0.4} />
                <stop offset="95%" stopColor={STROKE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={20}
              stroke="rgba(255,255,255,0.3)"
              fontSize={12}
            />
            <YAxis
              width={36}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              allowDecimals={false}
              domain={[0, 100]}
              stroke="rgba(255,255,255,0.3)"
              fontSize={12}
            />
            <ChartTooltip
              cursor={{
                stroke: "rgba(147,217,26,0.3)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={({
                active,
                payload,
                label,
                accessibilityLayer,
                activeIndex,
                coordinate,
              }) => (
                <ChartTooltipContent
                  active={active}
                  payload={payload}
                  label={label}
                  indicator="dot"
                  accessibilityLayer={accessibilityLayer}
                  activeIndex={activeIndex}
                  coordinate={coordinate}
                />
              )}
            />
            <Area
              dataKey="mastery"
              type="monotone"
              stroke={STROKE}
              fill="url(#masteryAreaCard)"
              fillOpacity={1}
              strokeWidth={3}
              name={t("mastery")}
              dot={{ r: 3, fill: STROKE, stroke: STROKE, strokeWidth: 0 }}
              activeDot={{
                r: 6,
                fill: STROKE,
                stroke: "rgba(3,9,19,0.95)",
                strokeWidth: 2,
              }}
              style={{ filter: `drop-shadow(0 0 6px ${GLOW})` }}
            />
          </RechartsAreaChart>
        </ShadcnChartContainer>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title={t("skillNoHistory")}
          className="border-0 py-8"
        />
      )}
    </ChartContainer>
  );
}
