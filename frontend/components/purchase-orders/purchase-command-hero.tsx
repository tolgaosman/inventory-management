"use client";

import { Clock, AlertTriangle, Send, PackageCheck } from "lucide-react";
import { CommandHero, type CommandHeroChip } from "@/components/common/command-hero";
import { formatCurrency } from "@/lib/format";
import type { PurchaseOrderStats } from "@/lib/api/purchase-orders";

/**
 * The page's command center — see `CommandHero` for the shared shell. Wires
 * up satın alma's specific headline (open order volume), meter (fill rate)
 * and chips (overdue / replenishment / draft / arriving-this-week).
 */
export function PurchaseCommandHero({
  stats,
  replenishmentCount,
  currency,
  rate,
  onOverdueClick,
  onReplenishmentClick,
  onDraftClick,
  onArrivingClick,
}: {
  stats?: PurchaseOrderStats;
  replenishmentCount?: number;
  currency: string;
  rate: number;
  onOverdueClick: () => void;
  onReplenishmentClick: () => void;
  onDraftClick: () => void;
  onArrivingClick: () => void;
}) {
  const fillRate = stats?.fillRatePercent ?? 0;

  const chips: CommandHeroChip[] = [
    { key: "overdue", icon: Clock, label: "geciken sipariş", value: stats?.overdueCount, onClick: onOverdueClick },
    { key: "replenishment", icon: AlertTriangle, label: "ikmal gerekli", value: replenishmentCount, onClick: onReplenishmentClick },
    { key: "draft", icon: Send, label: "taslak bekliyor", value: stats?.draftCount, onClick: onDraftClick },
    { key: "arriving", icon: PackageCheck, label: "bu hafta teslim", value: stats?.arrivingThisWeek, onClick: onArrivingClick },
  ];

  return (
    <CommandHero
      title="Satın Alma Merkezi"
      headlineLabel="Açık Sipariş Hacmi"
      headlineValue={stats ? formatCurrency(stats.openValue / rate, currency, 1, true) : undefined}
      meterLabel="Teslim Karşılanma Oranı"
      meterPercent={fillRate}
      meterValueLabel={stats ? `%${fillRate}` : undefined}
      chips={chips}
    />
  );
}
