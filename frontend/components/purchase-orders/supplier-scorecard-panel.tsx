"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, ChevronsUpDown, Truck } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import { performanceTextClass } from "@/lib/purchase-order-actions";
import type { SupplierScorecard } from "@/lib/api/purchase-orders";

type SortKey = "supplierName" | "totalOrders" | "totalValue" | "fillRatePercent" | "onTimeRatePercent" | "overdueCount";

const COLUMNS: { key: SortKey; label: string; align: "left" | "center" }[] = [
  { key: "supplierName", label: "Tedarikçi", align: "left" },
  { key: "totalOrders", label: "Sipariş", align: "center" },
  { key: "totalValue", label: "Toplam Hacim", align: "center" },
  { key: "fillRatePercent", label: "Karşılanma", align: "center" },
  { key: "onTimeRatePercent", label: "Zamanında", align: "center" },
  { key: "overdueCount", label: "Geciken", align: "center" },
];

export function SupplierScorecardPanel({
  scorecards,
  loading,
  currency,
  rate,
}: {
  scorecards: SupplierScorecard[];
  loading: boolean;
  currency: string;
  rate: number;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "totalValue", dir: "desc" });

  const sorted = useMemo(() => {
    const list = [...scorecards];
    list.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av ?? -1) - ((bv as number) ?? -1);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [scorecards, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (scorecards.length === 0) {
    return <EmptyState icon={Truck} title="Tedarikçi yok" description="Sisteme henüz bir tedarikçi eklenmemiş." />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-xs text-muted-foreground">
              {COLUMNS.map((col) => (
                <th key={col.key} className={cn("px-4 py-2.5", col.align === "center" ? "text-center" : "text-left")}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 select-none hover:text-foreground",
                      col.align === "center" && "justify-center w-full",
                    )}
                  >
                    {col.label}
                    {sort.key === col.key ? (
                      sort.dir === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronsUpDown className="size-3.5 opacity-40" />
                    )}
                  </button>
                </th>
              ))}
              <th className="px-4 py-2.5 text-center">Ort. Teslim</th>
              <th className="px-4 py-2.5 text-center">İptal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.supplierId} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/tedarikciler/${s.supplierId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                    {s.supplierName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{s.city} · {formatNumber(s.productCount)} ürün</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="tabular-nums font-medium text-foreground">{formatNumber(s.totalOrders)}</span>
                  {s.openOrders > 0 && <p className="text-xs tabular-nums text-muted-foreground">{formatNumber(s.openOrders)} açık</p>}
                </td>
                <td className="px-4 py-3 text-center tabular-nums font-semibold text-foreground">
                  {formatCurrency(s.totalValue / rate, currency, 1, true)}
                </td>
                <td className="px-4 py-3">
                  <div className="mx-auto flex max-w-24 flex-col items-center gap-1">
                    <Progress value={s.fillRatePercent} className="h-1.5 w-full">
                      <ProgressTrack className="h-1.5">
                        <ProgressIndicator />
                      </ProgressTrack>
                    </Progress>
                    <span className="text-micro tabular-nums text-muted-foreground">%{s.fillRatePercent}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {s.onTimeRatePercent === null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <span className={cn("tabular-nums font-semibold", performanceTextClass(s.onTimeRatePercent))}>
                      %{s.onTimeRatePercent}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {s.overdueCount > 0 ? (
                    <div>
                      <span className="tabular-nums font-semibold text-status-critical">{formatNumber(s.overdueCount)}</span>
                      <p className="text-xs tabular-nums text-muted-foreground">{formatNumber(s.overdueDays)} gün toplam</p>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {s.avgLeadDays === null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <div>
                      <span className="tabular-nums text-foreground">{s.avgLeadDays} gün</span>
                      {s.promisedLeadDays !== null && (
                        <p className="text-xs tabular-nums text-muted-foreground">vaat {s.promisedLeadDays}g</p>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                  {s.cancelledOrders > 0 ? formatNumber(s.cancelledOrders) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
