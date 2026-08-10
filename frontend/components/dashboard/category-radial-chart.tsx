"use client";

import { useMemo, useState } from "react";
import { PieChart, Table2, ChartSpline, Layers } from "lucide-react";
import type { CategoryShare } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS = [
  {
    stroke: "#06b6d4", // Cyan
    gradientId: "catCyan",
    bgLight: "bg-cyan-50 border-cyan-200 text-cyan-800",
    bgDark: "dark:bg-cyan-950/60 dark:border-cyan-500/30 dark:text-cyan-300",
    barColor: "bg-cyan-500",
  },
  {
    stroke: "#f59e0b", // Amber
    gradientId: "catAmber",
    bgLight: "bg-amber-50 border-amber-200 text-amber-800",
    bgDark: "dark:bg-amber-950/60 dark:border-amber-500/30 dark:text-amber-300",
    barColor: "bg-amber-500",
  },
  {
    stroke: "#10b981", // Emerald
    gradientId: "catEmerald",
    bgLight: "bg-emerald-50 border-emerald-200 text-emerald-800",
    bgDark: "dark:bg-emerald-950/60 dark:border-emerald-500/30 dark:text-emerald-300",
    barColor: "bg-emerald-500",
  },
  {
    stroke: "#8b5cf6", // Violet
    gradientId: "catViolet",
    bgLight: "bg-violet-50 border-violet-200 text-violet-800",
    bgDark: "dark:bg-violet-950/60 dark:border-violet-500/30 dark:text-violet-300",
    barColor: "bg-violet-500",
  },
  {
    stroke: "#f43f5e", // Rose
    gradientId: "catRose",
    bgLight: "bg-rose-50 border-rose-200 text-rose-800",
    bgDark: "dark:bg-rose-950/60 dark:border-rose-500/30 dark:text-rose-300",
    barColor: "bg-rose-500",
  },
];

export function CategoryRadialChart({ shares }: { shares: CategoryShare[] }) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const categories = useMemo(() => {
    if (!shares || shares.length === 0) {
      return [
        { categoryId: "cat-1", name: "Sunucu & Veri Merkezi", units: 72000 },
        { categoryId: "cat-2", name: "Ağ & Siber Güvenlik", units: 54000 },
        { categoryId: "cat-3", name: "Bilgisayar & İş İstasyonu", units: 39000 },
        { categoryId: "cat-4", name: "Yazılım & Lisanslama", units: 31000 },
        { categoryId: "cat-5", name: "Akıllı Kampüs & IoT", units: 25000 },
      ];
    }
    return shares.slice(0, 5);
  }, [shares]);

  const totalUnits = useMemo(() => categories.reduce((s, c) => s + c.units, 0), [categories]);
  const leader = categories[0];
  const leaderPercentage = Math.round((leader.units / (totalUnits || 1)) * 100);

  // Calculate Donut Slices
  let cumulativeAngle = -90; // Start top
  const slices = categories.map((cat, idx) => {
    const percentage = (cat.units / (totalUnits || 1)) * 100;
    const angleLength = (percentage / 100) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angleLength;
    const colorTheme = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

    return {
      ...cat,
      percentage: Math.round(percentage),
      startAngle,
      angleLength,
      colorTheme,
    };
  });

  const activeCat = categories.find((c) => c.categoryId === hoveredCategory) || leader;
  const activePercent = Math.round((activeCat.units / (totalUnits || 1)) * 100);

  return (
    <div className="relative flex flex-col justify-between rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0b0f17] p-6 shadow-sm dark:shadow-2xl text-slate-900 dark:text-slate-100 min-h-[380px] transition-colors">
      {/* Header - Identical to StockFlowChart */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Öne Çıkan Kategoriler</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kategori bazlı stok yoğunluğu ve payları</p>
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

          <div className="flex size-8 items-center justify-center rounded-full border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 shadow-sm">
            <PieChart className="size-4" />
          </div>
        </div>
      </div>

      {showTable ? (
        <div className="my-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d121c] p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="pb-2">Kategori</th>
                <th className="pb-2">Birim Adedi</th>
                <th className="pb-2">Pay (%)</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((c) => (
                <tr key={c.categoryId || c.name} className="border-b border-slate-200/70 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 font-medium flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: c.colorTheme.stroke }} />
                    {c.name}
                  </td>
                  <td className="py-2.5 font-semibold text-slate-900 dark:text-slate-100">{formatNumber(c.units)} adet</td>
                  <td className="py-2.5 font-semibold text-slate-600 dark:text-slate-300">%{c.percentage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="my-2 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center flex-1">
          {/* Left / Top: Interactive Donut Chart */}
          <div className="sm:col-span-5 relative flex items-center justify-center">
            <div className="relative aspect-square w-full max-w-[190px]">
              <svg viewBox="0 0 220 220" className="size-full -rotate-90 overflow-visible">
                <circle cx={110} cy={110} r={82} fill="none" className="stroke-slate-100 dark:stroke-slate-800/70" strokeWidth={16} />

                {slices.map((s) => {
                  const isHovered = hoveredCategory === s.categoryId || hoveredCategory === s.name;
                  const circumference = 2 * Math.PI * 82;
                  const strokeDash = (s.angleLength / 360) * circumference;
                  const gap = circumference - strokeDash;

                  return (
                    <circle
                      key={s.name}
                      cx={110}
                      cy={110}
                      r={82}
                      fill="none"
                      stroke={s.colorTheme.stroke}
                      strokeWidth={isHovered ? 22 : 16}
                      strokeDasharray={`${strokeDash} ${gap}`}
                      transform={`rotate(${s.startAngle + 90} 110 110)`}
                      className="cursor-pointer transition-all duration-300 hover:opacity-100"
                      opacity={hoveredCategory && !isHovered ? 0.4 : 0.95}
                      onMouseEnter={() => setHoveredCategory(s.categoryId || s.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    />
                  );
                })}
              </svg>

              {/* Center Info Readout */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                  %{activePercent}
                </span>
                <span className="text-[10.5px] font-extrabold leading-tight text-slate-600 dark:text-slate-300 mt-1 max-w-[105px] text-center">
                  {activeCat.name}
                </span>
              </div>
            </div>
          </div>

          {/* Right / Bottom: Category Progress Legend List (Fixed Number Positions & Non-wrapping Text) */}
          <div className="sm:col-span-7 space-y-2">
            {slices.map((c) => {
              const isHovered = hoveredCategory === c.categoryId || hoveredCategory === c.name;
              return (
                <div
                  key={c.name}
                  onMouseEnter={() => setHoveredCategory(c.categoryId || c.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={cn(
                    "group flex flex-col gap-1 rounded-xl border px-3 py-2 transition-all duration-200 cursor-pointer",
                    isHovered
                      ? "border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 shadow-sm"
                      : "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Left Category Name - Scaled Font */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.colorTheme.stroke }} />
                      <span className="text-[10px] sm:text-[11px] lg:text-[11.5px] font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
                        {c.name}
                      </span>
                    </div>

                    {/* Right Fixed Number Columns */}
                    <div className="flex items-center gap-2.5 shrink-0 text-[11px] sm:text-xs font-bold">
                      <span className="text-slate-400 dark:text-slate-400 min-w-[30px] text-right font-medium">%{c.percentage}</span>
                      <span className="text-slate-900 dark:text-slate-100 min-w-[44px] text-right">{formatNumber(c.units)}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", c.colorTheme.barColor)}
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Pill Summary - Matching StockFlowChart footer styling */}
      <div className="mt-3 flex items-center justify-between rounded-full border border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#080d14] px-4 py-2 text-xs">
        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
          <Layers className="size-3.5 text-amber-500" />
          Toplam Envanter Adedi
        </span>
        <span className="font-bold text-slate-900 dark:text-white">{formatNumber(totalUnits)} birim</span>
      </div>
    </div>
  );
}
