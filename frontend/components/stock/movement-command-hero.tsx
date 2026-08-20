"use client";

import { CalendarClock, Flame, Building2, Package, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from "lucide-react";
import { CommandHero, type CommandHeroChip } from "@/components/common/command-hero";
import { formatNumber } from "@/lib/format";
import type { MovementType } from "@/lib/types";

interface MovementHeroStats {
  todayIn: number;
  todayOut: number;
  fireCount: number;
  topWarehouseName?: string;
  topWarehouseCount?: number;
}

interface MovementTypeBreakdown {
  total?: number;
  in?: number;
  out?: number;
  transfer?: number;
}

/**
 * Stock movement history's command center. Every other view on this page is
 * an all-time total — the hero introduces "today" as a first-class concept
 * (net flow headline, in/out meter) and surfaces fire/iade as an anomaly
 * signal that today only exists buried in a reason label.
 */
export function MovementCommandHero({
  stats,
  onTodayClick,
  onFireClick,
  onTopWarehouseClick,
  typeBreakdown,
  onTypeClick,
}: {
  stats?: MovementHeroStats;
  onTodayClick: () => void;
  onFireClick: () => void;
  onTopWarehouseClick: () => void;
  typeBreakdown?: MovementTypeBreakdown;
  onTypeClick: (type: MovementType | "all") => void;
}) {
  const todayTotal = stats ? stats.todayIn + stats.todayOut : 0;
  const inPercent = stats && todayTotal > 0 ? Math.round((stats.todayIn / todayTotal) * 100) : 0;
  const net = stats ? stats.todayIn - stats.todayOut : 0;

  const chips: CommandHeroChip[] = [
    { key: "total", icon: Package, label: "toplam kayıt", value: typeBreakdown?.total, onClick: () => onTypeClick("all") },
    { key: "in", icon: ArrowDownToLine, label: "giriş", value: typeBreakdown?.in, onClick: () => onTypeClick("giris") },
    { key: "out", icon: ArrowUpFromLine, label: "çıkış", value: typeBreakdown?.out, onClick: () => onTypeClick("cikis") },
    { key: "transfer", icon: ArrowLeftRight, label: "transfer", value: typeBreakdown?.transfer, onClick: () => onTypeClick("transfer") },
    { key: "today", icon: CalendarClock, label: "bugünkü hareket", value: stats ? todayTotal : undefined, onClick: onTodayClick },
    { key: "fire", icon: Flame, label: "fire / iade", value: stats?.fireCount, onClick: onFireClick },
    { key: "top-warehouse", icon: Building2, label: stats?.topWarehouseName ?? "en hareketli depo", value: stats?.topWarehouseCount, onClick: onTopWarehouseClick },
  ];

  return (
    <CommandHero
      title="Stok Hareket Merkezi"
      headlineContent={
        <div className="flex gap-8">
          <div className="space-y-1.5">
            <p className="text-xl font-bold tracking-tight text-surface-inverse-foreground/70">Bugünkü Giriş</p>
            <span className="flex items-baseline text-[42px] font-bold leading-none tracking-tight tabular-nums text-surface-inverse-foreground">
              {stats ? formatNumber(stats.todayIn) : "—"}
            </span>
          </div>
          <div className="space-y-1.5">
            <p className="text-xl font-bold tracking-tight text-surface-inverse-foreground/70">Bugünkü Çıkış</p>
            <span className="flex items-baseline text-[42px] font-bold leading-none tracking-tight tabular-nums text-surface-inverse-foreground">
              {stats ? formatNumber(stats.todayOut) : "—"}
            </span>
          </div>
        </div>
      }
      meterLabel="Bugünkü Giriş Oranı"
      meterPercent={todayTotal > 0 ? inPercent : undefined}
      meterValueLabel={stats && todayTotal > 0 ? `%${inPercent}` : stats ? "—" : undefined}
      chips={chips}
    />
  );
}
