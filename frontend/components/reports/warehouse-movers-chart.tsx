"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { TrendingUp } from "lucide-react";
import { PanelCard } from "@/components/common/panel-card";
import { EmptyState } from "@/components/common/empty-state";
import { ChartTooltip } from "@/components/charts/chart-primitives";
import { formatNumber } from "@/lib/format";
import type { TopMover } from "@/lib/mock/dashboard";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function WarehouseMoversChart({ data, actions }: { data: TopMover[]; actions?: React.ReactNode }) {
  const totalQuantity = useMemo(() => data.reduce((s, d) => s + d.totalQuantity, 0), [data]);

  return (
    <PanelCard
      title="Depo Bazında En Çok Hareket Gören Ürünler"
      meta={data.length > 0 ? `${formatNumber(totalQuantity)} adet` : undefined}
      actions={actions}
    >
      {/* CSS-only hover: dim siblings without triggering React re-renders */}
      <style>{`
        .wmc-bar:hover .recharts-bar-rectangle { opacity: 0.6; transition: opacity 0.3s; }
        .wmc-bar .recharts-bar-rectangle { transition: opacity 0.3s; }
        .wmc-bar .recharts-bar-rectangle:hover { opacity: 1 !important; cursor: pointer; }
      `}</style>
      {data.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Hareket verisi yok" />
      ) : (
        <div className="min-h-[300px] w-full flex-1">
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 100, top: 16, bottom: 0 }}
              barSize={24}
              barCategoryGap="20%"
              className="wmc-bar"
            >
              <XAxis type="number" hide domain={[0, 'dataMax']} />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 500 }}
                width={180}
              />
              <Tooltip
                cursor={false}
                position={{ x: 8 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as TopMover;
                  return (
                    <ChartTooltip
                      title={d.name}
                      rows={[
                        { label: "Toplam Miktar", color: CHART_COLORS[data.indexOf(d) % CHART_COLORS.length], value: formatNumber(d.totalQuantity) },
                        { label: "Hareket Sayısı", color: "var(--muted-foreground)", value: formatNumber(d.movementCount), divider: true },
                      ]}
                    />
                  );
                }}
              />
              <Bar
                dataKey="totalQuantity"
                radius={[0, 8, 8, 0]}
                isAnimationActive={false}
                background={{ fill: "var(--muted)", opacity: 0.35, radius: 8 }}
              >
                {data.map((d, i) => (
                  <Cell
                    key={d.productId}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
                <LabelList
                  dataKey="totalQuantity"
                  position="right"
                  fill="var(--foreground)"
                  fontSize={12}
                  fontWeight={600}
                  formatter={(val: any) => formatNumber(Number(val) || 0)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}
