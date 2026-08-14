import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { capacityIndicatorClass } from "@/lib/capacity";
import type { WarehouseStockTotal } from "@/lib/mock/dashboard";
import { EmptyState } from "@/components/common/empty-state";
import { Warehouse } from "lucide-react";

export function WarehouseStockBars({ data }: { data: WarehouseStockTotal[] }) {
  const totalUnits = data.reduce((s, w) => s + w.units, 0);
  const totalCapacity = data.reduce((s, w) => s + w.capacity, 0);
  const overallPercent = totalCapacity > 0 ? Math.round((totalUnits / totalCapacity) * 100) : 0;

  return (
    <Card className="flex h-full flex-col py-5">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="flex items-center justify-between text-base font-semibold tracking-tight text-foreground">
          <span>Depo Bazında Stok</span>
          <span className="text-xs font-normal text-muted-foreground">{data.length} depo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 px-5">
        {data.length === 0 ? (
          <EmptyState icon={Warehouse} title="Depo verisi yok" />
        ) : (
          <>
            <div className="max-h-[280px] space-y-4 overflow-y-auto custom-scrollbar pr-1">
              {data.map((w) => {
                const percent = w.capacity > 0 ? Math.round((w.units / w.capacity) * 100) : 0;
                return (
                  <div key={w.warehouseId}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Warehouse className="size-3.5" />
                        </div>
                        <span className="truncate text-sm font-semibold text-foreground">{w.name}</span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatNumber(w.units)} / {formatNumber(w.capacity)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-300 bg-emerald-500"
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">Toplam doluluk</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(totalUnits)} / {formatNumber(totalCapacity)} (%{overallPercent})
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
