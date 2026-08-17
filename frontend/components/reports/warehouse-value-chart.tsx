"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Wallet } from "lucide-react";
import { PanelCard } from "@/components/common/panel-card";
import { EmptyState } from "@/components/common/empty-state";
import { ChartTooltip } from "@/components/charts/chart-primitives";
import { formatCurrency } from "@/lib/format";
import type { WarehouseDetail } from "@/lib/mock/dashboard";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function WarehouseValueChart({
  data,
  currency,
  rate,
}: {
  data: WarehouseDetail[];
  currency: string;
  rate: number;
}) {
  const ranked = useMemo(() => [...data].sort((a, b) => b.totalValue - a.totalValue), [data]);
  const totalValue = useMemo(() => data.reduce((s, w) => s + w.totalValue, 0), [data]);

  return (
    <PanelCard
      title="Depo Başına Envanter Değeri"
      meta={data.length > 0 ? formatCurrency(totalValue / rate, currency, 1, true) : undefined}
    >
      {/* CSS-only hover: dim siblings without triggering React re-renders */}
      <style>{`
        .wvc-bar:hover .recharts-bar-rectangle { opacity: 0.6; transition: opacity 0.3s; }
        .wvc-bar .recharts-bar-rectangle { transition: opacity 0.3s; }
        .wvc-bar .recharts-bar-rectangle:hover { opacity: 1 !important; cursor: pointer; }
      `}</style>
      {ranked.length === 0 ? (
        <EmptyState icon={Wallet} title="Veri yok" />
      ) : (
        <div className="w-full flex-1 min-h-[320px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={320}>
            <BarChart 
              data={ranked} 
              layout="vertical" 
              margin={{ left: 0, right: 120, top: 16, bottom: 0 }} 
              barSize={28}
              barCategoryGap="20%"
              className="wvc-bar"
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
                  const d = payload[0].payload as WarehouseDetail;
                  return (
                    <ChartTooltip
                      title={d.name}
                      rows={[
                        { label: "Envanter Değeri", color: CHART_COLORS[ranked.findIndex(w => w.warehouseId === d.warehouseId) % CHART_COLORS.length], value: formatCurrency(d.totalValue / rate, currency, 1, true) },
                        { label: "Ürün Çeşidi", color: "var(--muted-foreground)", value: `${d.productCount} SKU`, divider: true },
                      ]}
                    />
                  );
                }}
              />
              <Bar 
                dataKey="totalValue" 
                radius={[0, 8, 8, 0]} 
                isAnimationActive={false}
                background={{ fill: "var(--muted)", opacity: 0.35, radius: 8 }}
              >
                {ranked.map((w, i) => (
                  <Cell
                    key={w.warehouseId}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
                <LabelList 
                  dataKey="totalValue"
                  position="right"
                  fill="var(--foreground)"
                  fontSize={12}
                  fontWeight={600}
                  formatter={(val: any) => formatCurrency((Number(val) || 0) / rate, currency, 1, false).replace(/\s/g, '\u00A0')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}
