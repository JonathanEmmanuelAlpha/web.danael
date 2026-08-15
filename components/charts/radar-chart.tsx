"use client";

import * as React from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
} from "recharts";
import {
  ChartContainer as ShadcnChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartContainer } from "@/components/charts/chart-container";

export interface RadarChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface RadarChartCardProps {
  title: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  series: RadarChartSeries[];
  axisKey: string;
  height?: string;
  loading?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  className?: string;
}

const DEFAULT_COLORS = [
  { stroke: "#93d91a", glow: "rgba(147,217,26,0.5)" }, // chart-1 lime
  { stroke: "#22d3ee", glow: "rgba(34,211,238,0.5)" }, // chart-2 cyan
  { stroke: "#a78bfa", glow: "rgba(167,139,250,0.5)" }, // chart-3 violet
  { stroke: "#fbbf24", glow: "rgba(251,191,36,0.5)" }, // chart-4 amber
  { stroke: "#fb7185", glow: "rgba(251,113,133,0.5)" }, // chart-5 coral
];

/**
 * Radar chart card for multi-dimension stats (subject proficiency).
 *
 * Aurora Navy refonte:
 *  - Polygon: fill chart-1 opacity 0.2, stroke chart-1.
 *  - First series gets a `drop-shadow` glow filter.
 *  - PolarGrid: `rgba(255,255,255,0.08)`.
 *  - PolarAngleAxis ticks: `rgba(255,255,255,0.1)` text-xs.
 *  - PolarRadiusAxis: subtle `rgba(255,255,255,0.15)`.
 */
export function RadarChartCard({
  title,
  description,
  data,
  series,
  axisKey,
  height = "280px",
  loading = false,
  emptyMessage = "No data yet",
  action,
  className,
}: RadarChartCardProps) {
  const hasData = data.length > 0;
  const config: ChartConfig = React.useMemo(() => {
    const c: ChartConfig = {};
    series.forEach((s, i) => {
      const entry = s.color
        ? { stroke: s.color, glow: s.color }
        : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      c[s.key] = {
        label: s.label,
        color: entry.stroke,
      };
    });
    return c;
  }, [series]);

  return (
    <ChartContainer
      title={title}
      description={description}
      action={action}
      loading={loading}
      height={height}
      className={className}
    >
      {!hasData ? (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height }}
        >
          {emptyMessage}
        </div>
      ) : (
        <ShadcnChartContainer
          config={config}
          style={{ height }}
          className="mx-auto w-full"
        >
          <RechartsRadarChart data={data} outerRadius="80%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey={axisKey}
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            />
            <PolarRadiusAxis
              tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 10 }}
              stroke="rgba(255,255,255,0.1)"
              axisLine={false}
            />
            <ChartTooltip
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
            {series.map((s, i) => {
              const entry = s.color
                ? { stroke: s.color, glow: s.color }
                : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              const isFirst = i === 0;
              return (
                <Radar
                  key={s.key}
                  dataKey={s.key}
                  stroke={entry.stroke}
                  fill={entry.stroke}
                  fillOpacity={isFirst ? 0.2 : 0.12}
                  name={s.label}
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill: entry.stroke,
                    stroke: entry.stroke,
                    strokeWidth: 0,
                  }}
                  style={
                    isFirst
                      ? { filter: `drop-shadow(0 0 6px ${entry.glow})` }
                      : undefined
                  }
                />
              );
            })}
          </RechartsRadarChart>
        </ShadcnChartContainer>
      )}
    </ChartContainer>
  );
}
