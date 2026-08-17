"use client";

import { Truck, Package, MapPin, AlertTriangle, PackageX } from "lucide-react";
import { CommandHero, type CommandHeroChip } from "@/components/common/command-hero";
import { formatCurrency } from "@/lib/format";

interface SupplierHeroStats {
  totalCount: number;
  totalProducts: number;
  cityCount: number;
  totalOpenValue: number;
  avgOnTimePercent: number | null;
  riskyCount: number;
  noProductsCount: number;
}

/**
 * Suppliers' command center. `Supplier` itself is a thin contact-card type —
 * the real signal comes from `getSupplierScorecards()` (built for satın
 * alma's own scorecard tab), reused here rather than recomputed. Headline is
 * the open order volume resting with these suppliers; the meter is average
 * on-time delivery; the risky-supplier chip deep-links into the full
 * sortable scorecard instead of rebuilding it on this page.
 */
export function SupplierCommandHero({
  stats,
  currency,
  rate,
  onOverviewClick,
  onRiskyClick,
  onNoProductsClick,
}: {
  stats?: SupplierHeroStats;
  currency: string;
  rate: number;
  onOverviewClick: () => void;
  onRiskyClick: () => void;
  onNoProductsClick: () => void;
}) {
  const chips: CommandHeroChip[] = [
    { key: "total", icon: Truck, label: "toplam tedarikçi", value: stats?.totalCount, onClick: onOverviewClick },
    { key: "products", icon: Package, label: "toplam ürün çeşidi", value: stats?.totalProducts, onClick: onOverviewClick },
    { key: "cities", icon: MapPin, label: "şehir sayısı", value: stats?.cityCount, onClick: onOverviewClick },
    { key: "risky", icon: AlertTriangle, label: "riskli tedarikçi", value: stats?.riskyCount, onClick: onRiskyClick },
    { key: "no-products", icon: PackageX, label: "ürünsüz tedarikçi", value: stats?.noProductsCount, onClick: onNoProductsClick },
  ];

  return (
    <CommandHero
      title="Tedarikçi Performans Merkezi"
      headlineLabel="Toplam Açık Sipariş Hacmi"
      headlineValue={stats ? formatCurrency(stats.totalOpenValue / rate, currency, 1, true) : undefined}
      meterLabel="Ortalama Zamanında Teslimat"
      meterPercent={stats?.avgOnTimePercent ?? undefined}
      meterValueLabel={stats ? (stats.avgOnTimePercent === null ? "—" : `%${stats.avgOnTimePercent}`) : undefined}
      chips={chips}
    />
  );
}
