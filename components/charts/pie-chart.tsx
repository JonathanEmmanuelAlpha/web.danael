"use client";

import * as React from "react";
import { Cell, Label, Pie, PieChart as RechartsPieChart } from "recharts";
import {
  ChartContainer as ShadcnChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartContainer } from "@/components/charts/chart-container";

export interface PieChartSlice {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export interface PieChartCardProps {
  title: string;
  description?: string;
  data: PieChartSlice[];
  height?: string;
  loading?: boolean;
  emptyMessage?: string;
  action?: React.ReactNode;
  className?: string;
  /** Render a donut with a centered label (default true). */
  donut?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
}

const DEFAULT_COLORS = [
  "#93d91a", // chart-1 lime
  "#22d3ee", // chart-2 cyan
  "#a78bfa", // chart-3 violet
  "#fbbf24", // chart-4 amber
  "#fb7185", // chart-5 coral
];

/**
 * Pie / donut chart card for distributions (role distribution, content types).
 *
 * Aurora Navy refonte:
 *  - Donut mode (default) with `innerRadius=60` and a `paddingAngle=4` gap
 *    between slices for a clean, modern look.
 *  - Cells use the chart-1..chart-5 palette; explicit `s.color` overrides.
 *  - Each slice gets a subtle outer glow via a `<filter>` on the Pie.
 *  - Optional centered label uses `font-display` for the value + muted for
 *    the label.
 */
export function PieChartCard({
  title,
  description,
  data,
  height = "260px",
  loading = false,
  emptyMessage = "No data yet",
  action,
  className,
  donut = true,
  centerLabel,
  centerValue,
}: PieChartCardProps) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0);
  const total = data.reduce((acc, d) => acc + d.value, 0);

  const config: ChartConfig = React.useMemo(() => {
    const c: ChartConfig = {};
    data.forEach((s, i) => {
      const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      c[s.key] = {
        label: s.label,
        color,
      };
    });
    return c;
  }, [data]);

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
          <RechartsPieChart>
            <defs>
              {/* Subtle drop-shadow for slice glow (only on the pie). */}
              <filter id="pieGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
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
                  accessibilityLayer={accessibilityLayer}
                  activeIndex={activeIndex}
                  coordinate={coordinate}
                  nameKey="label"
                  hideLabel
                />
              )}
            />
            <Pie
              data={data.map((d) => ({ ...d, name: d.label }))}
              dataKey="value"
              nameKey="key"
              innerRadius={donut ? 60 : 0}
              outerRadius={90}
              paddingAngle={donut ? 4 : 0}
              strokeWidth={2}
              stroke="rgba(3,9,19,0.6)"
            >
              {data.map((s, i) => {
                const color =
                  s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
                return <Cell key={s.key} fill={color} />;
              })}
              {donut && centerValue != null && (
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx as number}
                          y={viewBox.cy as number}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx as number}
                            y={(viewBox.cy as number) - 8}
                            className="fill-foreground font-display text-2xl font-bold"
                          >
                            {centerValue}
                          </tspan>
                          {centerLabel && (
                            <tspan
                              x={viewBox.cx as number}
                              y={(viewBox.cy as number) + 14}
                              className="fill-muted-foreground text-xs"
                            >
                              {centerLabel}
                            </tspan>
                          )}
                        </text>
                      );
                    }
                    return null;
                  }}
                />
              )}
            </Pie>
            <text x="0" y="0" visibility="hidden">
              {total}
            </text>
          </RechartsPieChart>
        </ShadcnChartContainer>
      )}
    </ChartContainer>
  );
}
