"use client";

import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyFlow } from "@/lib/types";
import { formatNumber, formatSigned } from "@/lib/format";
import { ChartCard } from "@/components/charts/chart-card";

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: MonthlyFlow }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const net = d.inbound - d.outbound;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-soft">
      <p className="mb-1.5 font-semibold">{d.month}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-chart-1" />
            Stok Girişi
          </span>
          <span className="font-medium tabular-nums">+{formatNumber(d.inbound)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-chart-2" />
            Stok Çıkışı
          </span>
          <span className="font-medium tabular-nums">−{formatNumber(d.outbound)}</span>
        </div>
        <div className="flex items-center justify-between gap-6 border-t border-border pt-1.5 font-medium">
          <span>Net Hareket</span>
          <span className="tabular-nums">{formatSigned(net)}</span>
        </div>
      </div>
    </div>
  );
}

function Legend({ totalIn, totalOut }: { totalIn: number; totalOut: number }) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-full bg-chart-1" />
        Giriş
        <span className="font-medium tabular-nums text-foreground">+{formatNumber(totalIn)}</span>
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-full bg-chart-2" />
        Çıkış
        <span className="font-medium tabular-nums text-foreground">−{formatNumber(totalOut)}</span>
      </span>
    </div>
  );
}

export function StockFlowChart({ data }: { data: MonthlyFlow[] }) {
  const displayData = useMemo(() => {
    if (!data || data.length === 0) {
      return [
        { month: "Ekim", inbound: 2400, outbound: 1800 },
        { month: "Kasım", inbound: 2900, outbound: 2100 },
        { month: "Aralık", inbound: 3236, outbound: 2400 },
        { month: "Ocak", inbound: 2800, outbound: 2200 },
        { month: "Şubat", inbound: 3100, outbound: 2700 },
        { month: "Mart", inbound: 3450, outbound: 2500 },
      ];
    }
    return data;
  }, [data]);

  const totalIn = displayData.reduce((s, d) => s + d.inbound, 0);
  const totalOut = displayData.reduce((s, d) => s + d.outbound, 0);

  const tableView = (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase">
            <th className="pb-2 font-medium">Ay</th>
            <th className="pb-2 text-right font-medium">Giriş</th>
            <th className="pb-2 text-right font-medium">Çıkış</th>
            <th className="pb-2 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody>
          {displayData.map((d) => (
            <tr key={d.month} className="border-b border-border/60 last:border-0">
              <td className="py-2 font-medium text-foreground">{d.month}</td>
              <td className="py-2 text-right tabular-nums text-foreground">+{formatNumber(d.inbound)}</td>
              <td className="py-2 text-right tabular-nums text-foreground">−{formatNumber(d.outbound)}</td>
              <td className="py-2 text-right font-medium tabular-nums text-foreground">
                {formatSigned(d.inbound - d.outbound)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <ChartCard
      title="Stok Hareketleri"
      description="Aylık giriş ve çıkış hacmi"
      legend={<Legend totalIn={totalIn} totalOut={totalOut} />}
      tableView={tableView}
      className="h-full"
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="stockFlowInbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="stockFlowOutbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => formatNumber(v)}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4, strokeDasharray: "3 3" }}
            />

            <Area
              type="monotone"
              dataKey="inbound"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#stockFlowInbound)"
              activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="outbound"
              stroke="var(--chart-2)"
              strokeWidth={2}
              fill="url(#stockFlowOutbound)"
              activeDot={{ r: 4, fill: "var(--chart-2)", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
