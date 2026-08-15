"use client";

import * as React from "react";
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

export interface AreaChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface AreaChartCardProps {
  title: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  series: AreaChartSeries[];
  xKey: string;
  /** Optional Y-axis tick formatter (e.g. for compact numbers). */
  yFormatter?: (v: number) => string;
  /** Optional X-axis tick formatter (e.g. for short dates). */
  xFormatter?: (v: string) => string;
  height?: string;
  loading?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Solid chart colors + rgba glow colors for the first-series drop-shadow. */
const DEFAULT_COLORS = [
  { stroke: "#93d91a", glow: "rgba(147,217,26,0.5)" }, // chart-1 lime
  { stroke: "#22d3ee", glow: "rgba(34,211,238,0.5)" }, // chart-2 cyan
  { stroke: "#a78bfa", glow: "rgba(167,139,250,0.5)" }, // chart-3 violet
  { stroke: "#fbbf24", glow: "rgba(251,191,36,0.5)" }, // chart-4 amber
  { stroke: "#fb7185", glow: "rgba(251,113,133,0.5)" }, // chart-5 coral
];

/**
 * Stacked / overlay area chart for time-series (activity, growth, engagement).
 *
 * Aurora Navy refonte:
 *  - Each area uses a vertical `<linearGradient>` (stop-color chart-N,
 *    stop-opacity 0.4 → 0).
 *  - Line stroke uses chart-N, strokeWidth 2 (3 on the first series).
 *  - First series gets a `drop-shadow` glow filter for the neon effect.
 *  - CartesianGrid: `rgba(255,255,255,0.05)`; ticks: `rgba(255,255,255,0.3)`.
 */
export function AreaChartCard({
  title,
  description,
  data,
  series,
  xKey,
  yFormatter,
  xFormatter,
  height = "240px",
  loading = false,
  emptyMessage = "No data yet",
  action,
  className,
}: AreaChartCardProps) {
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
          className="w-full"
        >
          <RechartsAreaChart
            data={data}
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <defs>
              {series.map((s, i) => {
                const entry = s.color
                  ? { stroke: s.color, glow: s.color }
                  : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
                return (
                  <linearGradient
                    key={`areaGrad-${s.key}`}
                    id={`areaGrad-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={entry.stroke}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor={entry.stroke}
                      stopOpacity={0}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              stroke="rgba(255,255,255,0.3)"
              fontSize={12}
              tickFormatter={
                xFormatter ? (x) => xFormatter(String(x)) : undefined
              }
            />
            <YAxis
              width={36}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              allowDecimals={false}
              stroke="rgba(255,255,255,0.3)"
              fontSize={12}
              tickFormatter={
                yFormatter ? (v) => yFormatter(Number(v)) : undefined
              }
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
            {series.map((s, i) => {
              const entry = s.color
                ? { stroke: s.color, glow: s.color }
                : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              const isFirst = i === 0;
              return (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={entry.stroke}
                  fill={`url(#areaGrad-${s.key})`}
                  fillOpacity={1}
                  strokeWidth={isFirst ? 3 : 2}
                  name={s.label}
                  style={
                    isFirst
                      ? { filter: `drop-shadow(0 0 6px ${entry.glow})` }
                      : undefined
                  }
                />
              );
            })}
          </RechartsAreaChart>
        </ShadcnChartContainer>
      )}
    </ChartContainer>
  );
}
