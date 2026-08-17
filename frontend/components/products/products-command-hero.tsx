"use client";

import { Package, AlertTriangle, TrendingDown, PackagePlus, CircleDot } from "lucide-react";
import { CommandHero, type CommandHeroChip } from "@/components/common/command-hero";
import { formatCurrency } from "@/lib/format";
import type { ProductStats } from "@/lib/api/products";

/**
 * Products' command center. Headline is the catalog's total inventory value
 * (already computed, previously buried in a small StatGrid tile); the meter
 * is the share of the catalog sitting in a healthy stock band; chips jump
 * straight into the stockStatus/status filters — including "fazla" (the
 * first place `Product.maxStock` is aggregated) and "pasif" (a filter that
 * didn't exist before this pass).
 */
export function ProductsCommandHero({
  stats,
  currency,
  rate,
  onTotalClick,
  onCriticalClick,
  onLowClick,
  onOverstockClick,
  onPassiveClick,
}: {
  stats?: ProductStats;
  currency: string;
  rate: number;
  onTotalClick: () => void;
  onCriticalClick: () => void;
  onLowClick: () => void;
  onOverstockClick: () => void;
  onPassiveClick: () => void;
}) {
  const healthyPercent = stats && stats.total > 0
    ? Math.round(((stats.total - stats.critical - stats.low) / stats.total) * 100)
    : 0;

  const chips: CommandHeroChip[] = [
    { key: "total", icon: Package, label: "toplam ürün", value: stats?.total, onClick: onTotalClick },
    { key: "critical", icon: AlertTriangle, label: "kritik stok", value: stats?.critical, onClick: onCriticalClick },
    { key: "low", icon: TrendingDown, label: "düşük stok", value: stats?.low, onClick: onLowClick },
    { key: "overstock", icon: PackagePlus, label: "stok fazlası", value: stats?.overstock, onClick: onOverstockClick },
    { key: "passive", icon: CircleDot, label: "pasif ürün", value: stats?.passive, onClick: onPassiveClick },
  ];

  return (
    <CommandHero
      title="Envanter Merkezi"
      headlineLabel="Toplam Envanter Değeri"
      headlineValue={stats ? formatCurrency(stats.stockValue / rate, currency, 1, true) : undefined}
      meterLabel="Sağlıklı Stok Oranı"
      meterPercent={healthyPercent}
      meterValueLabel={stats ? `%${healthyPercent}` : undefined}
      chips={chips}
    />
  );
}
