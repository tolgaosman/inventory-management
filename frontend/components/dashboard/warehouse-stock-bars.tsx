import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { WarehouseStockTotal } from "@/lib/mock/dashboard";
import { EmptyState } from "@/components/common/empty-state";
import { Warehouse } from "lucide-react";

export function WarehouseStockBars({ data }: { data: WarehouseStockTotal[] }) {
  const max = Math.max(...data.map((d) => d.units), 1);

  return (
    <Card className="shadow-soft border-border/70 flex flex-col justify-between py-5 min-h-[360px]">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
          <span>Depo Bazında Stok</span>
          <span className="text-xs font-normal text-muted-foreground">{data.length} depo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 flex-1 min-h-0">
        {data.length === 0 ? (
          <EmptyState icon={Warehouse} title="Depo verisi yok" />
        ) : (
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar space-y-3.5 pr-1.5">
            {data.map((w) => (
              <div key={w.warehouseId} className="space-y-1.5 group rounded-xl p-2 transition-colors hover:bg-muted/40">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground text-xs sm:text-sm">{w.name}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2 shrink-0">{formatNumber(w.units)} adet</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${Math.max((w.units / max) * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
