"use client";

import { useMemo, useState } from "react";
import { Area, ComposedChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDown, Table2, ChartSpline } from "lucide-react";
import type { MonthlyFlow } from "@/lib/types";
import { formatNumber, formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: MonthlyFlow }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const net = d.inbound - d.outbound;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/95 dark:bg-[#0f172a]/95 p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1.5 font-semibold text-slate-900 dark:text-slate-200">{d.month}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4 text-amber-600 dark:text-amber-400">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500 shadow-sm" />
            Stok Girişi
          </span>
          <span className="font-bold">+{formatNumber(d.inbound)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-cyan-600 dark:text-cyan-400">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cyan-500 shadow-sm" />
            Stok Çıkışı
          </span>
          <span className="font-bold">-{formatNumber(d.outbound)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-1.5 text-slate-700 dark:text-slate-300 font-medium">
          <span>Net Hareket</span>
          <span>{formatSigned(net)}</span>
        </div>
      </div>
    </div>
  );
}

export function StockFlowChart({ data }: { data: MonthlyFlow[] }) {
  const [selectedRange, setSelectedRange] = useState("Son 6 Ay");
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

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

  const chartData = useMemo(
    () =>
      displayData.map((d) => ({
        ...d,
        inboundVal: d.inbound,
        outboundVal: d.outbound * 0.75,
      })),
    [displayData],
  );

  return (
    <div className="relative flex flex-col justify-between h-full rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0b0f17] p-6 shadow-sm dark:shadow-2xl text-slate-900 dark:text-slate-100 min-h-[380px] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Stok Hareketleri</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Akış haritası: giriş, çıkış ve canlı stok yükü</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Table Toggle Button */}
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            className="flex items-center justify-center size-8 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#121824] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={showTable ? "Grafik Görünümü" : "Tablo Görünümü"}
          >
            {showTable ? <ChartSpline className="size-4" /> : <Table2 className="size-4" />}
          </button>

          {/* Timeframe Dropdown */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#121824] px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <span>{selectedRange}</span>
              <ChevronDown className="size-3.5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {showTable ? (
        <div className="my-4 flex-1 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d121c] p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="pb-2">Ay</th>
                <th className="pb-2">Giriş Hacmi</th>
                <th className="pb-2">Çıkış Hacmi</th>
                <th className="pb-2">Net Stok</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((d) => (
                <tr key={d.month} className="border-b border-slate-200/70 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 font-medium">{d.month}</td>
                  <td className="py-2.5 text-amber-600 dark:text-amber-400 font-semibold">+{formatNumber(d.inbound)}</td>
                  <td className="py-2.5 text-cyan-600 dark:text-cyan-400 font-semibold">-{formatNumber(d.outbound)}</td>
                  <td className="py-2.5 font-semibold text-slate-900 dark:text-slate-200">{formatSigned(d.inbound - d.outbound)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative my-2 flex-1 min-h-[220px] w-full">
          {/* Floating Stat Badges */}
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/90 dark:bg-gradient-to-r dark:from-amber-950/70 dark:via-amber-900/40 dark:to-slate-900/80 px-4 py-2 shadow-sm dark:shadow-[0_0_25px_rgba(245,158,11,0.18)] backdrop-blur-md">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-amber-700 dark:text-amber-400/90 uppercase">Stok Girişi</p>
              <p className="text-base font-extrabold tracking-tight text-amber-600 dark:text-amber-300">+{formatNumber(totalIn)}</p>
            </div>
          </div>

          <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-3 rounded-2xl border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50/90 dark:bg-gradient-to-r dark:from-slate-900/80 dark:via-cyan-950/40 dark:to-cyan-950/70 px-4 py-2 shadow-sm dark:shadow-[0_0_25px_rgba(6,182,212,0.18)] backdrop-blur-md">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-cyan-700 dark:text-cyan-400/90 uppercase text-right">Stok Çıkışı</p>
              <p className="text-base font-extrabold tracking-tight text-cyan-600 dark:text-cyan-300">-{formatNumber(totalOut)}</p>
            </div>
          </div>

          {/* Flow Map Graph Canvas */}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 40, right: 10, left: 10, bottom: 0 }}>
              <defs>
                {/* Inbound Amber Flow Gradient */}
                <linearGradient id="amberFlowGradientLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#fbbf24" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#d97706" stopOpacity={0.03} />
                </linearGradient>

                {/* Outbound Cyan Flow Gradient */}
                <linearGradient id="cyanFlowGradientLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#22d3ee" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity={0.03} />
                </linearGradient>

                {/* Glow Filters */}
                <filter id="glowAmberLight" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glowCyanLight" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} />

              {/* Upper Inbound Flow Stream */}
              <Area
                type="natural"
                dataKey="inboundVal"
                stroke="#d97706"
                strokeWidth={3}
                fill="url(#amberFlowGradientLight)"
                style={{ filter: "url(#glowAmberLight)" }}
                activeDot={{ r: 6, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
              />

              {/* Lower Outbound Flow Stream */}
              <Area
                type="natural"
                dataKey="outboundVal"
                stroke="#0284c7"
                strokeWidth={2.5}
                fill="url(#cyanFlowGradientLight)"
                style={{ filter: "url(#glowCyanLight)" }}
                activeDot={{ r: 6, fill: "#06b6d4", stroke: "#fff", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Month Selector Pills Footer */}
      <div className="mt-3 flex items-center justify-between gap-1.5 rounded-full border border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#080d14] p-1.5">
        {displayData.map((d, i) => {
          const isSelected = activeMonth === d.month || (activeMonth === null && (i === 2 || i === 4));
          const isAmberHighlight = i === 2;
          const isCyanHighlight = i === 4;

          return (
            <button
              key={d.month}
              type="button"
              onMouseEnter={() => setActiveMonth(d.month)}
              onMouseLeave={() => setActiveMonth(null)}
              onClick={() => setActiveMonth((m) => (m === d.month ? null : d.month))}
              className={cn(
                "flex-1 rounded-full py-1.5 text-center text-xs font-semibold transition-all duration-200",
                isAmberHighlight
                  ? "border border-amber-400 dark:border-amber-500/60 bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 shadow-sm"
                  : isCyanHighlight
                    ? "border border-cyan-400 dark:border-cyan-500/60 bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 shadow-sm"
                    : isSelected
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900/60",
              )}
            >
              {d.month.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
