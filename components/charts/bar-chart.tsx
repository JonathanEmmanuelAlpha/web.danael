"use client";

import * as React from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
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

export interface BarChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface BarChartCardProps {
  title: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  series: BarChartSeries[];
  xKey: string;
  layout?: "horizontal" | "vertical";
  yFormatter?: (v: number) => string;
  xFormatter?: (v: string) => string;
  height?: string;
  loading?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Solid chart colors + matching "light" stops for gradient fills. */
const DEFAULT_COLORS = [
  { fill: "#93d91a", light: "#b6e366" }, // chart-1 lime
  { fill: "#22d3ee", light: "#67e8f9" }, // chart-2 cyan
  { fill: "#a78bfa", light: "#c4b5fd" }, // chart-3 violet
  { fill: "#fbbf24", light: "#fcd34d" }, // chart-4 amber
  { fill: "#fb7185", light: "#fda4af" }, // chart-5 coral
];

/**
 * Bar chart card for comparisons (class performance, subject scores).
 *
 * Aurora Navy refonte:
 *  - Bars use a vertical `<linearGradient>` (light stop → base color) with
 *    rounded corners and a soft outer glow.
 *  - CartesianGrid uses `rgba(255,255,255,0.05)` (subtle).
 *  - Axis ticks use `rgba(255,255,255,0.3)` at `text-xs`.
 *  - Tooltip inherits the `glass-strong` styling from `ChartTooltipContent`.
 */
export function BarChartCard({
  title,
  description,
  data,
  series,
  xKey,
  layout = "horizontal",
  yFormatter,
  xFormatter,
  height = "240px",
  loading = false,
  emptyMessage = "No data yet",
  action,
  className,
}: BarChartCardProps) {
  const hasData = data.length > 0;
  const config: ChartConfig = React.useMemo(() => {
    const c: ChartConfig = {};
    series.forEach((s, i) => {
      const entry = s.color
        ? { fill: s.color, light: s.color }
        : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      c[s.key] = {
        label: s.label,
        color: entry.fill,
      };
    });
    return c;
  }, [series]);

  const isVertical = layout === "vertical";

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
          <RechartsBarChart
            data={data}
            layout={layout}
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <defs>
              {series.map((s, i) => {
                const entry = s.color
                  ? { fill: s.color, light: s.color }
                  : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
                return (
                  <linearGradient
                    key={`barGrad-${s.key}`}
                    id={`barGrad-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={entry.light}
                      stopOpacity={0.95}
                    />
                    <stop
                      offset="100%"
                      stopColor={entry.fill}
                      stopOpacity={0.55}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid
              vertical={isVertical}
              horizontal={!isVertical}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3 3"
            />
            {isVertical ? (
              <>
                <XAxis
                  type="number"
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
                <YAxis
                  type="category"
                  dataKey={xKey}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                  stroke="rgba(255,255,255,0.3)"
                  fontSize={12}
                  tickFormatter={
                    xFormatter ? (v) => xFormatter(String(v)) : undefined
                  }
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={xKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={12}
                  stroke="rgba(255,255,255,0.3)"
                  fontSize={12}
                  tickFormatter={
                    xFormatter ? (v) => xFormatter(String(v)) : undefined
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
              </>
            )}
            <ChartTooltip
              cursor={{ fill: "rgba(147,217,26,0.06)", radius: 4 }}
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
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={`url(#barGrad-${s.key})`}
                name={s.label}
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </RechartsBarChart>
        </ShadcnChartContainer>
      )}
    </ChartContainer>
  );
}
