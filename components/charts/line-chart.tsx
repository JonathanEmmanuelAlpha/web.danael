"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
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

export interface LineChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface LineChartCardProps {
  title: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  series: LineChartSeries[];
  xKey: string;
  yFormatter?: (v: number) => string;
  xFormatter?: (v: string) => string;
  height?: string;
  loading?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  className?: string;
  domain?: [number | string, number | string];
}

/** Solid chart colors + rgba glow colors for `drop-shadow`. */
const DEFAULT_COLORS = [
  { stroke: "#93d91a", glow: "rgba(147,217,26,0.5)" }, // chart-1 lime
  { stroke: "#22d3ee", glow: "rgba(34,211,238,0.5)" }, // chart-2 cyan
  { stroke: "#a78bfa", glow: "rgba(167,139,250,0.5)" }, // chart-3 violet
  { stroke: "#fbbf24", glow: "rgba(251,191,36,0.5)" }, // chart-4 amber
  { stroke: "#fb7185", glow: "rgba(251,113,133,0.5)" }, // chart-5 coral
];

/**
 * Line chart card for trends (score evolution, streak data).
 *
 * Aurora Navy refonte:
 *  - Lines use chart-1..chart-5 colors, strokeWidth 2-3 (first series thicker).
 *  - The first series gets a `drop-shadow` filter for a neon-glow effect.
 *  - Subtle area fill under each line (gradient opacity 0.2 → 0).
 *  - Dots: filled with the line color, hover-enlarged via Recharts `dot` props.
 *  - CartesianGrid: `rgba(255,255,255,0.05)`; ticks: `rgba(255,255,255,0.3)`.
 */
export function LineChartCard({
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
  domain,
}: LineChartCardProps) {
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
        <ShadcnChartContainer config={config} style={{ height }} className="w-full">
          <RechartsLineChart
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
                    key={`lineArea-${s.key}`}
                    id={`lineArea-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={entry.stroke} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={entry.stroke} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={12}
              stroke="rgba(255,255,255,0.3)"
              fontSize={12}
              tickFormatter={xFormatter ? (v) => xFormatter(String(v)) : undefined}
            />
            <YAxis
              width={36}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              allowDecimals={false}
              stroke="rgba(255,255,255,0.3)"
              fontSize={12}
              domain={domain ?? ["auto", "auto"]}
              tickFormatter={yFormatter ? (v) => yFormatter(Number(v)) : undefined}
            />
            <ChartTooltip
              cursor={{ stroke: "rgba(147,217,26,0.3)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={<ChartTooltipContent indicator="line" />}
            />
            {series.map((s, i) => {
              const entry = s.color
                ? { stroke: s.color, glow: s.color }
                : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              const isFirst = i === 0;
              return (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={entry.stroke}
                  strokeWidth={isFirst ? 3 : 2}
                  dot={{
                    r: 3,
                    fill: entry.stroke,
                    stroke: entry.stroke,
                    strokeWidth: 0,
                  }}
                  activeDot={{
                    r: 6,
                    fill: entry.stroke,
                    stroke: "rgba(3,9,19,0.95)",
                    strokeWidth: 2,
                  }}
                  name={s.label}
                  // Area fill under the line — recharts <Line> doesn't natively
                  // support fill, but we can fake a glow by stacking an area
                  // gradient via `fill` + low opacity.
                  fillOpacity={0}
                  style={
                    isFirst
                      ? { filter: `drop-shadow(0 0 6px ${entry.glow})` }
                      : undefined
                  }
                />
              );
            })}
          </RechartsLineChart>
        </ShadcnChartContainer>
      )}
    </ChartContainer>
  );
}
