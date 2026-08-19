"use client";

import {
  ComposedChart,
  Line,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { MonthlyFlow } from "@/lib/types";
import { formatNumber, formatSigned } from "@/lib/format";
import { EmptyState } from "@/components/common/empty-state";
import { PanelCard } from "@/components/common/panel-card";
import {
  CHART_GRID,
  CHART_LINE_WIDTH,
  CHART_X_AXIS,
  CHART_Y_AXIS,
  ChartLegend,
  ChartTooltip,
  chartActiveDot,
} from "@/components/charts/chart-primitives";

/**
 * The flow triad. These are token references, not hexes: `--series-2` already
 * lifts to a legible blue in dark mode, which is why this chart no longer needs
 * a duplicated `dark:hidden` / `hidden dark:block` line pair for the outbound
 * series.
 */
const SERIES = {
  inbound: "var(--series-1)",
  outbound: "var(--series-2)",
  net: "var(--series-3)",
} as const;

const LEGEND = [
  { label: "Giriş Hacmi", color: SERIES.inbound },
  { label: "Çıkış Hacmi", color: SERIES.outbound },
  { label: "Net Hareket", color: SERIES.net },
];

function FlowTooltip({ active, payload }: { active?: boolean; payload?: { payload: FlowDatum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <ChartTooltip
      title={d.month}
      rows={[
        { label: "Giriş", color: SERIES.inbound, value: formatNumber(d.inbound) },
        { label: "Çıkış", color: SERIES.outbound, value: formatNumber(d.displayOutbound) },
        { label: "Net", color: SERIES.net, value: formatSigned(d.net), divider: true },
      ]}
    />
  );
}

interface FlowDatum extends MonthlyFlow {
  displayOutbound: number;
  net: number;
  bgRange: [number, number];
}

export function StockFlowChart({ data }: { data: MonthlyFlow[] }) {
  const isEmpty = !data || data.length === 0 || data.every((d) => d.inbound === 0 && d.outbound === 0);

  const displayData = (data ?? []).map((d) => {
    const inbound = Number(d.inbound) || 0;
    const outbound = Number(d.outbound) || 0;
    return {
      ...d,
      inbound,
      outbound,
      displayOutbound: Math.abs(outbound), // Chart all as positive curves to match aesthetic
      net: inbound - outbound,
    };
  });

  // Calculate scales for background bars
  const maxVal = Math.max(
    0,
    ...displayData.map((d) => Math.max(d.inbound, d.displayOutbound, Math.abs(d.net)))
  );
  const minVal = Math.min(0, ...displayData.map((d) => d.net));

  const yMax = maxVal === 0 ? 100 : Math.ceil(maxVal * 1.1);
  const yMin = minVal < 0 ? Math.floor(minVal * 1.1) : 0;

  const enhancedData: FlowDatum[] = displayData.map((d) => ({
    ...d,
    bgRange: [yMin, yMax], // Defines the top and bottom of the background bar
  }));

  // Share of months that closed net-positive — the one number the headline shows.
  const healthyMonths = displayData.filter((d) => d.net >= 0).length;
  const healthPercent = displayData.length > 0 ? Math.round((healthyMonths / displayData.length) * 100) : 0;

  if (isEmpty) {
    return (
      <PanelCard variant="hero">
        <EmptyState
          icon={BarChart3}
          title="Veri Bulunamadı"
          description="Seçili tarih aralığında stok girişi veya çıkışı bulunamadı."
        />
      </PanelCard>
    );
  }

  return (
    <PanelCard variant="hero">
      <div className="mb-8 flex flex-col items-start justify-between gap-6 sm:flex-row">
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold tracking-tight text-muted-foreground">Stok Sağlığı</h3>
          <div className="flex items-center gap-4">
            <span className="flex items-baseline text-[42px] font-bold leading-none tracking-tight tabular-nums text-foreground">
              {healthPercent}
              <span className="ml-0.5 text-2xl font-semibold text-muted-foreground">%</span>
            </span>
            {/* Ten ticks, filled to the health percentage — a compact read of the
                same number for anyone scanning rather than reading. */}
            <div className="flex h-8 items-end gap-1.5 pb-1">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < Math.round(healthPercent / 10);
                return (
                  <div
                    key={i}
                    className="w-1.5 rounded-full"
                    style={{
                      height: filled ? "100%" : "40%",
                      backgroundColor: filled ? SERIES.inbound : "var(--muted)",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <ChartLegend items={LEGEND} className="mt-2" />
      </div>

      <div className="min-h-[260px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enhancedData} margin={{ top: 10, right: 0, left: -16, bottom: 12 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="month" {...CHART_X_AXIS} />
            <YAxis
              {...CHART_Y_AXIS}
              domain={[yMin, yMax]}
              width={85}
              tickFormatter={(v) => (v === 0 ? "0" : formatNumber(v))}
            />
            <Tooltip content={<FlowTooltip />} cursor={false} />

            {/* Decorative column track behind each month, so sparse months still
                read as a slot rather than empty space. */}
            <Bar
              dataKey="bgRange"
              fill="var(--muted)"
              opacity={0.4}
              radius={[6, 6, 6, 6]}
              barSize={10}
              isAnimationActive={false}
            />

            <Line
              type="linear"
              dataKey="inbound"
              stroke={SERIES.inbound}
              strokeWidth={CHART_LINE_WIDTH}
              dot={false}
              activeDot={chartActiveDot(SERIES.inbound)}
            />
            <Line
              type="linear"
              dataKey="displayOutbound"
              stroke={SERIES.outbound}
              strokeWidth={CHART_LINE_WIDTH}
              dot={false}
              activeDot={chartActiveDot(SERIES.outbound)}
            />
            <Line
              type="linear"
              dataKey="net"
              stroke={SERIES.net}
              strokeWidth={CHART_LINE_WIDTH}
              dot={false}
              activeDot={chartActiveDot(SERIES.net)}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </PanelCard>
  );
}
