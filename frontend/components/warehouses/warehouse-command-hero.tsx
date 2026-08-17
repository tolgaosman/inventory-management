"use client";

import { Warehouse as WarehouseIcon, Package, AlertTriangle, Gauge, Trophy } from "lucide-react";
import { CommandHero, type CommandHeroChip } from "@/components/common/command-hero";
import { formatCurrency } from "@/lib/format";

interface WarehouseHeroStats {
  totalCount: number;
  totalUnits: number;
  totalValue: number;
  avgCapacity: number;
  criticalCapacityCount: number;
  idleCapacityCount: number;
  topValueWarehouseName?: string;
}

/**
 * Warehouses' command center. Headline is total inventory value across
 * locations (already computed, previously a small StatGrid tile); the meter
 * is average capacity usage; chips surface the two capacity extremes that
 * today are only implied by a per-card progress-bar color, never counted.
 */
export function WarehouseCommandHero({
  stats,
  currency,
  rate,
  onTotalClick,
  onCriticalCapacityClick,
  onIdleCapacityClick,
  onTopValueClick,
}: {
  stats?: WarehouseHeroStats;
  currency: string;
  rate: number;
  onTotalClick: () => void;
  onCriticalCapacityClick: () => void;
  onIdleCapacityClick: () => void;
  onTopValueClick: () => void;
}) {
  const chips: CommandHeroChip[] = [
    { key: "total", icon: WarehouseIcon, label: "toplam depo", value: stats?.totalCount, onClick: onTotalClick },
    { key: "units", icon: Package, label: "toplam stok adedi", value: stats?.totalUnits, onClick: onTotalClick },
    { key: "critical", icon: AlertTriangle, label: "kritik doluluk", value: stats?.criticalCapacityCount, onClick: onCriticalCapacityClick },
    { key: "idle", icon: Gauge, label: "atıl kapasite", value: stats?.idleCapacityCount, onClick: onIdleCapacityClick },
    { key: "top", icon: Trophy, label: "en değerli depo", value: stats?.topValueWarehouseName, onClick: onTopValueClick },
  ];

  return (
    <CommandHero
      title="Depo Kontrol Merkezi"
      headlineLabel="Depolardaki Toplam Envanter Değeri"
      headlineValue={stats ? formatCurrency(stats.totalValue / rate, currency, 1, true) : undefined}
      meterLabel="Ortalama Doluluk Oranı"
      meterPercent={stats?.avgCapacity}
      meterValueLabel={stats ? `%${stats.avgCapacity}` : undefined}
      chips={chips}
    />
  );
}
