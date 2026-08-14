"use client";

import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import type { MonthlyFlow } from "@/lib/types";
import { formatNumber, formatSigned } from "@/lib/format";
import { ChartCard } from "@/components/charts/chart-card";
import { EmptyState } from "@/components/common/empty-state";

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
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
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-chart-3" />
            Net Hareket
          </span>
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
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-full bg-chart-3" />
        Net
        <span className="font-medium tabular-nums text-foreground">{formatSigned(totalIn - totalOut)}</span>
      </span>
    </div>
  );
}

export function StockFlowChart({ data }: { data: MonthlyFlow[] }) {
  const displayData = (data ?? []).map((d) => ({
    ...d,
    displayOutbound: -d.outbound,
    net: d.inbound - d.outbound,
  }));
  const isEmpty = displayData.every((d) => d.inbound === 0 && d.outbound === 0);

  const totalIn = displayData.reduce((s, d) => s + d.inbound, 0);
  const totalOut = displayData.reduce((s, d) => s + d.outbound, 0);

  // Find peaks to show the glowing circles
  let maxInIndex = 0;
  let maxOutIndex = 0;
  let maxNetIndex = 0;
  displayData.forEach((d, i) => {
    if (d.inbound > displayData[maxInIndex].inbound) maxInIndex = i;
    if (Math.abs(d.displayOutbound) > Math.abs(displayData[maxOutIndex].displayOutbound)) maxOutIndex = i;
    if (Math.abs(d.net) > Math.abs(displayData[maxNetIndex].net)) maxNetIndex = i;
  });

  const renderCustomDot = (props: any, peakIndex: number) => {
    const { cx, cy, value, index, stroke } = props;
    if (index === peakIndex) {
      return (
        <g key={`dot-${index}`}>
          <circle cx={cx} cy={cy} r={22} fill={stroke} filter={`drop-shadow(0px 0px 8px ${stroke})`} opacity={0.3} />
          <circle cx={cx} cy={cy} r={20} fill={stroke} />
          <text x={cx} y={cy} textAnchor="middle" dy={4} fill="white" fontSize={13} fontWeight="bold">
            {value > 0 ? formatNumber(value) : value < 0 ? `-${formatNumber(Math.abs(value))}` : 0}
          </text>
        </g>
      );
    }
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4.5} fill="#0b1121" stroke={stroke} strokeWidth={2.5} />;
  };

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
              <td className="py-2 text-right tabular-nums text-foreground">−{formatNumber(Math.abs(d.displayOutbound))}</td>
              <td className="py-2 text-right font-medium tabular-nums text-foreground">
                {formatSigned(d.net)}
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
      tableView={isEmpty ? undefined : tableView}
      className="h-full"
    >
      {isEmpty ? (
        <EmptyState icon={BarChart3} title="Bu dönem için hareket verisi yok" description="Seçili tarih aralığında stok girişi veya çıkışı bulunamadı." />
      ) : (
      <div className="h-[280px] w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={true} horizontal={true} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickMargin={12}
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

            <Line
              type="monotone"
              dataKey="inbound"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              dot={(props) => renderCustomDot(props, maxInIndex)}
              activeDot={{ r: 6, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="displayOutbound"
              stroke="var(--chart-2)"
              strokeWidth={2.5}
              dot={(props) => renderCustomDot(props, maxOutIndex)}
              activeDot={{ r: 6, fill: "var(--chart-2)", stroke: "var(--card)", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="net"
              stroke="var(--chart-3)"
              strokeWidth={2.5}
              dot={(props) => renderCustomDot(props, maxNetIndex)}
              activeDot={{ r: 6, fill: "var(--chart-3)", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}
    </ChartCard>
  );
}
