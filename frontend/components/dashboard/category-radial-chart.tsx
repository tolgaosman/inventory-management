"use client";

import { useMemo, useState } from "react";
import type { CategoryShare } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/charts/chart-card";

/** Series colours come from the theme's chart tokens, never from raw hex. */
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function CategoryRadialChart({ shares }: { shares: CategoryShare[] }) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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

  // Each slice's start angle is the running total of the ones before it.
  const slices = categories.reduce<
    Array<(typeof categories)[number] & { percentage: number; startAngle: number; angleLength: number; color: string }>
  >((acc, cat, idx) => {
    const percentage = (cat.units / (totalUnits || 1)) * 100;
    const angleLength = (percentage / 100) * 360;
    const startAngle = -90 + acc.reduce((sum, s) => sum + s.angleLength, 0);
    acc.push({ ...cat, percentage: Math.round(percentage), startAngle, angleLength, color: SERIES[idx % SERIES.length] });
    return acc;
  }, []);

  const activeCat = categories.find((c) => c.categoryId === hoveredCategory) || leader;
  const activePercent = Math.round((activeCat.units / (totalUnits || 1)) * 100);

  const tableView = (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase">
            <th className="pb-2 font-medium">Kategori</th>
            <th className="pb-2 text-right font-medium">Adet</th>
            <th className="pb-2 text-right font-medium">Pay</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((c) => (
            <tr key={c.categoryId || c.name} className="border-b border-border/60 last:border-0">
              <td className="flex items-center gap-2 py-2 font-medium text-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </td>
              <td className="py-2 text-right tabular-nums text-foreground">{formatNumber(c.units)}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">%{c.percentage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <ChartCard
      title="Öne Çıkan Kategoriler"
      description="Kategori bazlı stok dağılımı"
      tableView={tableView}
      className="h-full"
    >
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-12">
        {/* Donut */}
        <div className="flex items-center justify-center sm:col-span-5">
          <div className="relative aspect-square w-full max-w-[180px]">
            <svg viewBox="0 0 220 220" className="size-full -rotate-90 overflow-visible">
              <circle cx={110} cy={110} r={82} fill="none" stroke="var(--muted)" strokeWidth={18} />
              {slices.map((s) => {
                const isHovered = hoveredCategory === s.categoryId || hoveredCategory === s.name;
                const circumference = 2 * Math.PI * 82;
                const strokeDash = (s.angleLength / 360) * circumference;
                return (
                  <circle
                    key={s.name}
                    cx={110}
                    cy={110}
                    r={82}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={18}
                    strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                    transform={`rotate(${s.startAngle + 90} 110 110)`}
                    className="cursor-pointer transition-opacity duration-200"
                    opacity={hoveredCategory && !isHovered ? 0.35 : 1}
                    onMouseEnter={() => setHoveredCategory(s.categoryId || s.name)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  />
                );
              })}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <span className="text-xl font-bold tabular-nums text-foreground">%{activePercent}</span>
              <span className="mt-0.5 max-w-[100px] line-clamp-2 text-micro leading-tight text-muted-foreground text-balance">
                {activeCat.name}
              </span>
            </div>
          </div>
        </div>

        {/* Legend list */}
        <div className="space-y-2 sm:col-span-7">
          {slices.map((c) => {
            const isHovered = hoveredCategory === c.categoryId || hoveredCategory === c.name;
            return (
              <div
                key={c.name}
                onMouseEnter={() => setHoveredCategory(c.categoryId || c.name)}
                onMouseLeave={() => setHoveredCategory(null)}
                className={cn(
                  "cursor-pointer space-y-1.5 rounded-md px-2 py-1.5 transition-colors",
                  isHovered ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="truncate text-xs font-medium text-foreground">{c.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                    <span className="min-w-[34px] text-right text-muted-foreground">%{c.percentage}</span>
                    <span className="min-w-[48px] text-right font-medium text-foreground">{formatNumber(c.units)}</span>
                  </div>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${c.percentage}%`, backgroundColor: c.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Toplam envanter adedi</span>
        <span className="font-medium tabular-nums text-foreground">{formatNumber(totalUnits)}</span>
      </div>
    </ChartCard>
  );
}
